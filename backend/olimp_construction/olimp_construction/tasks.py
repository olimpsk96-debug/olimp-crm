"""Cron-задачи и doc_events Olimp Construction.

Расписание зарегистрировано в hooks.py (scheduler_events).
Принципы:
- Каждая задача обёрнута в try/except и пишет в лог — чтобы один сбой не валил весь раннер.
- Telegram-сообщения агрегируются (одно сообщение со списком), а не по одному на тендер/единицу техники.
- Если зависимый DocType ещё не создан — задача аккуратно логирует "skipped" и завершается.
"""
from __future__ import annotations

from datetime import timedelta

import frappe
from frappe.utils import add_days, flt, getdate, now_datetime

from olimp_construction.telegram_utils import (
    STATUSES_ACTIVE,
    format_deadline_alert,
    send_message,
)


# ────────────────────────────── Техника ──────────────────────────────────────


# Порог в днях для каждого типа алертов
_EQUIPMENT_WARN_DAYS = {
    "next_maintenance_date": 7,    # ТО — за неделю
    "insurance_expiry": 30,        # страховка — за месяц
    "certification_expiry": 30,    # поверка — за месяц
    "sro_expiry": 30,              # СРО — за месяц
}
_EQUIPMENT_LABELS = {
    "next_maintenance_date": "ТО",
    "insurance_expiry": "Страховка",
    "certification_expiry": "Поверка",
    "sro_expiry": "СРО",
}


def check_equipment_alerts() -> None:
    """Daily: проверяет сроки ТО, страховок, СРО, поверок по технике.

    Шлёт в Telegram **одно** агрегированное сообщение со списком, если есть алерты.
    Игнорирует технику со статусом «Списана».
    """
    try:
        today = getdate()
        equipment_list = frappe.get_all(
            "Equipment",
            filters={"status": ["!=", "Списана"]},
            fields=[
                "name", "equipment_name", "inventory_code", "status",
                "next_maintenance_date", "insurance_expiry",
                "certification_expiry", "sro_expiry",
            ],
        )

        alerts: list[tuple[int, str]] = []  # (days_left, text)

        for eq in equipment_list:
            for field, warn_days in _EQUIPMENT_WARN_DAYS.items():
                expiry = eq.get(field)
                if not expiry:
                    continue
                days_left = (getdate(expiry) - today).days
                if days_left < 0 or days_left > warn_days:
                    continue

                kind = _EQUIPMENT_LABELS[field]
                eq_title = eq.get("equipment_name") or eq["name"]
                inv = f" (инв. {eq['inventory_code']})" if eq.get("inventory_code") else ""

                if days_left == 0:
                    line = f"🔴 <b>{kind} сегодня</b>: {eq_title}{inv}"
                elif days_left == 1:
                    line = f"🔴 <b>{kind} завтра</b>: {eq_title}{inv}"
                else:
                    line = f"🟡 {kind} через {days_left} {_days_word(days_left)}: {eq_title}{inv}"

                alerts.append((days_left, line))

        if not alerts:
            frappe.logger().info("Equipment alerts: 0 events today")
            return

        alerts.sort(key=lambda x: x[0])
        body = "\n".join(a[1] for a in alerts)
        text = f"🛠 <b>Техника — события на ближайшие 30 дней ({len(alerts)})</b>\n\n{body}"
        sent = send_message(text)
        frappe.logger().info(
            f"Equipment alerts: {len(alerts)} events — "
            f"{'отправлено' if sent else 'не отправлено (нет токена)'}"
        )

    except Exception:
        frappe.log_error(frappe.get_traceback(), "check_equipment_alerts")


# ────────────────────────────── ОТ/ТБ ───────────────────────────────────────


def check_safety_clearance_expiry() -> None:
    """Daily: алерты по охране труда.

    Логика:
    - Все критические и тяжёлые инциденты со статусом «Открыт» — каждый день напоминаем.
    - Прочие открытые инциденты старше 7 дней — алерт «висит без движения».
    """
    try:
        today = getdate()
        cutoff_stale = add_days(today, -7)

        critical = frappe.get_all(
            "Safety Incident",
            filters={
                "status": "Открыт",
                "severity": ["in", ["Тяжёлый", "Критический"]],
            },
            fields=["name", "severity", "incident_date", "project", "description"],
            order_by="incident_date asc",
        )

        stale = frappe.get_all(
            "Safety Incident",
            filters={
                "status": "Открыт",
                "severity": ["in", ["Незначительный", "Средний"]],
                "incident_date": ["<=", cutoff_stale],
            },
            fields=["name", "severity", "incident_date", "project", "description"],
            order_by="incident_date asc",
        )

        if not critical and not stale:
            frappe.logger().info("Safety alerts: 0 open incidents requiring attention")
            return

        lines: list[str] = []
        if critical:
            lines.append(f"🚨 <b>Тяжёлые/критические инциденты ({len(critical)})</b>")
            for inc in critical[:5]:  # ограничиваем 5 чтобы не разрывать сообщение
                days_open = (today - getdate(inc["incident_date"])).days if inc.get("incident_date") else 0
                proj = f" · {inc['project']}" if inc.get("project") else ""
                desc = (inc.get("description") or "").splitlines()[0][:80]
                lines.append(f"• [{inc['severity']}] {inc['name']}{proj} ({days_open}д открыт)\n  {desc}")

        if stale:
            if lines:
                lines.append("")
            lines.append(f"⚠️ <b>Инциденты висят без движения &gt;7 дней ({len(stale)})</b>")
            for inc in stale[:5]:
                days_open = (today - getdate(inc["incident_date"])).days if inc.get("incident_date") else 0
                proj = f" · {inc['project']}" if inc.get("project") else ""
                lines.append(f"• [{inc['severity']}] {inc['name']}{proj} ({days_open}д открыт)")

        text = "\n".join(lines)
        sent = send_message(text)
        frappe.logger().info(
            f"Safety alerts: {len(critical)} critical, {len(stale)} stale — "
            f"{'отправлено' if sent else 'не отправлено'}"
        )

    except Exception:
        frappe.log_error(frappe.get_traceback(), "check_safety_clearance_expiry")


# ────────────────────────────── Тендеры ─────────────────────────────────────


def check_tender_deadlines() -> None:
    """Daily: отправляет Telegram-алерты о дедлайнах тендеров (1, 3, 7 дней)."""
    today = getdate()
    warning_days = [7, 3, 1]

    for days in warning_days:
        target_date = add_days(today, days)
        tenders = frappe.get_all(
            "Tender",
            filters={
                "deadline_date": target_date,
                "status": ["in", list(STATUSES_ACTIVE)],
            },
            fields=[
                "name", "title", "status", "nmck",
                "work_type", "region",
                "deadline_date", "deadline_time",
                "ai_match_score", "ai_recommendation",
            ],
        )
        for tender in tenders:
            text = format_deadline_alert(tender, days)
            sent = send_message(text)
            frappe.logger().info(
                f"Tender deadline alert ({days}д): {tender['name']} — "
                f"{'отправлено' if sent else 'не отправлено (нет токена)'}"
            )


# ────────────────────────────── CRM ─────────────────────────────────────────


def check_crm_followups() -> None:
    """Daily: Telegram-напоминания по next_action_date — задачам CRM."""
    today = getdate()

    pending = frappe.db.sql(
        """SELECT i.name, i.customer, c.customer_name, i.next_action, i.next_action_date,
                  i.contact_name,
                  CASE WHEN i.next_action_date < %s THEN 1 ELSE 0 END as overdue
           FROM `tabInteraction` i
           LEFT JOIN `tabCustomer` c ON c.name = i.customer
           WHERE i.next_action_date = %s AND IFNULL(i.next_action, '') != ''
           ORDER BY i.next_action_date ASC""",
        (str(today), str(today)),
        as_dict=True,
    )

    overdue = frappe.db.sql(
        """SELECT i.name, i.customer, c.customer_name, i.next_action, i.next_action_date,
                  DATEDIFF(%s, i.next_action_date) as days_overdue
           FROM `tabInteraction` i
           LEFT JOIN `tabCustomer` c ON c.name = i.customer
           WHERE i.next_action_date < %s AND IFNULL(i.next_action, '') != ''
           ORDER BY i.next_action_date ASC
           LIMIT 5""",
        (str(today), str(today)),
        as_dict=True,
    )

    if not pending and not overdue:
        return

    lines = ["📋 <b>CRM — задачи на сегодня</b>"]

    if pending:
        for p in pending:
            client = p.get("customer_name") or p["customer"]
            contact = f" ({p['contact_name']})" if p.get("contact_name") else ""
            lines.append(f"• <b>{client}</b>{contact}\n  → {p['next_action']}")

    if overdue:
        lines.append("\n⚠️ <b>Просроченные:</b>")
        for o in overdue:
            client = o.get("customer_name") or o["customer"]
            days = o.get("days_overdue", 0)
            lines.append(f"• <b>{client}</b> (просроч. {days}д)\n  → {o['next_action']}")

    text = "\n".join(lines)
    sent = send_message(text)
    frappe.logger().info(
        f"CRM follow-ups Telegram alert: {len(pending)} сегодня, {len(overdue)} просроч. — "
        f"{'отправлено' if sent else 'не отправлено'}"
    )


# ────────────────────────────── Cashflow / AI (заглушки) ─────────────────────


def update_customer_payment_patterns() -> None:
    """Weekly: пересчитывает паттерны оплаты заказчиков.

    TODO: реализовать после создания DocType `Customer Payment Pattern` (см. SCHEMA_v5.md).
    Логика: по истории KS2 Act (act_date → дата фактической оплаты) считаем
    среднюю задержку и стандартное отклонение для каждого Customer.
    """
    if not frappe.db.exists("DocType", "Customer Payment Pattern"):
        frappe.logger().info("update_customer_payment_patterns: DocType отсутствует — пропуск")
        return
    # Реализация в следующей итерации


def generate_cashflow_snapshot() -> None:
    """Weekly: создаёт снимок прогноза cashflow для отчётности.

    TODO: реализовать после создания DocType `Cashflow Forecast Snapshot` (см. SCHEMA_v5.md).
    Логика: вызвать `api.cashflow.get_dashboard()` и сохранить результат как документ
    с привязкой к дате — для построения графика «прогноз → факт».
    """
    if not frappe.db.exists("DocType", "Cashflow Forecast Snapshot"):
        frappe.logger().info("generate_cashflow_snapshot: DocType отсутствует — пропуск")
        return
    # Реализация в следующей итерации


def run_ai_recommendation_engine() -> None:
    """Hourly: запускает движок rule-based AI-рекомендаций.

    TODO: реализовать после создания DocType `AI Pattern` и `AI Recommendation`
    (см. AI_ASSISTANT.md раздел 6, SCHEMA_v5.md).
    Логика: для каждого активного AI Pattern выполнить condition_query,
    создать AI Recommendation если матч, отправить уведомление если urgency≥High.
    """
    if not frappe.db.exists("DocType", "AI Pattern"):
        frappe.logger().info("run_ai_recommendation_engine: DocType отсутствует — пропуск")
        return
    # Реализация в следующей итерации


# ────────────────────────────── Маржа проекта ───────────────────────────────


def recalculate_project_margin(doc, method: str | None = None) -> None:
    """Doc-event on_update Construction Project: пересчитывает факт-маржу.

    Считает:
    - real_revenue = Σ KS2.amount где status="Подписан" и привязан к проекту
    - real_cost = Σ Material Request.total_estimated где status in ("Заказана", "Получена")
    - real_margin_amount = real_revenue - real_cost
    - real_margin_pct = (real_margin_amount / real_revenue) × 100
    - ks2_completion_pct = (real_revenue / contract_amount) × 100

    Использует `db_set(update_modified=False)` чтобы не было рекурсии on_update.
    """
    try:
        # method передаётся Frappe doc_events, но мы можем быть вызваны и вручную
        if not doc or not getattr(doc, "name", None):
            return

        revenue = flt(frappe.db.sql(
            """SELECT IFNULL(SUM(amount), 0)
               FROM `tabKS2 Act`
               WHERE project = %s AND status = 'Подписан'""",
            (doc.name,),
        )[0][0])

        cost = flt(frappe.db.sql(
            """SELECT IFNULL(SUM(total_estimated), 0)
               FROM `tabMaterial Request`
               WHERE project = %s AND status IN ('Одобрена', 'Закупается', 'Получена')""",
            (doc.name,),
        )[0][0])

        margin_amount = revenue - cost
        margin_pct = (margin_amount / revenue * 100.0) if revenue > 0 else 0.0
        completion_pct = (revenue / flt(doc.contract_amount) * 100.0) if flt(doc.contract_amount) > 0 else 0.0

        updates = {
            "real_revenue": revenue,
            "real_cost": cost,
            "real_margin_amount": margin_amount,
            "real_margin_pct": margin_pct,
            "ks2_completion_pct": completion_pct,
        }
        # db_set без триггера on_update (update_modified=False избегает рекурсии)
        for field, value in updates.items():
            if hasattr(doc, field):
                doc.db_set(field, value, update_modified=False)

        frappe.logger().info(
            f"Project margin: {doc.name} → revenue={revenue:.0f}, cost={cost:.0f}, "
            f"margin={margin_amount:.0f} ({margin_pct:.1f}%), completion={completion_pct:.1f}%"
        )

    except Exception:
        frappe.log_error(frappe.get_traceback(), f"recalculate_project_margin({getattr(doc, 'name', '?')})")


def on_ks2_update_recalc_project(doc, method: str | None = None) -> None:
    """Doc-event on_update KS2 Act: триггерит пересчёт маржи связанного Construction Project."""
    try:
        if not doc or not getattr(doc, "project", None):
            return
        if not frappe.db.exists("Construction Project", doc.project):
            return
        proj = frappe.get_doc("Construction Project", doc.project)
        recalculate_project_margin(proj)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "on_ks2_update_recalc_project")


def on_material_request_update_recalc_project(doc, method: str | None = None) -> None:
    """Doc-event on_update Material Request: триггерит пересчёт маржи проекта."""
    try:
        if not doc or not getattr(doc, "project", None):
            return
        if not frappe.db.exists("Construction Project", doc.project):
            return
        proj = frappe.get_doc("Construction Project", doc.project)
        recalculate_project_margin(proj)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "on_material_request_update_recalc_project")


# ────────────────────────────── Helpers ─────────────────────────────────────


def _days_word(n: int) -> str:
    if n == 1:
        return "день"
    if 2 <= n <= 4:
        return "дня"
    return "дней"
