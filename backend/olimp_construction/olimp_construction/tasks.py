"""Cron-задачи и doc_events Olimp Construction.

Расписание зарегистрировано в hooks.py (scheduler_events).
Принципы:
- Каждая задача обёрнута в try/except и пишет в лог — чтобы один сбой не валил весь раннер.
- Telegram-сообщения агрегируются (одно сообщение со списком), а не по одному на тендер/единицу техники.
- Если зависимый DocType ещё не создан — задача аккуратно логирует "skipped" и завершается.
"""
from __future__ import annotations

import os
from datetime import timedelta

import frappe
from frappe.utils import add_days, flt, getdate, now_datetime, nowdate

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


# ────────────────────────────── Punch List ───────────────────────────────────


def check_punch_list_overdue() -> None:
    """Daily: сводный Telegram о просроченных доделках.

    Берёт все Punch List Item со status IN ('Открыто','В работе') и due_date < today.
    Чтобы не спамить ежедневно — для каждого item смотрим next_reminder_sent:
    напоминание уходит только если оно либо null, либо отправлено более 7 дней назад.
    После успешной отправки next_reminder_sent проставляется в today.
    """
    try:
        if not frappe.db.exists("DocType", "Punch List Item"):
            frappe.logger().info("check_punch_list_overdue: DocType отсутствует — пропуск")
            return

        today_d = getdate()
        cutoff = add_days(today_d, -7)  # напоминаем не чаще раза в неделю

        items = frappe.db.sql(
            """
            SELECT name, title, assignee, due_date, urgency, project,
                   next_reminder_sent
            FROM `tabPunch List Item`
            WHERE status IN ('Открыто', 'В работе')
              AND due_date IS NOT NULL
              AND due_date < %(today)s
              AND (next_reminder_sent IS NULL OR next_reminder_sent <= %(cutoff)s)
            ORDER BY due_date ASC
            """,
            {"today": str(today_d), "cutoff": str(cutoff)},
            as_dict=True,
        )

        if not items:
            frappe.logger().info("check_punch_list_overdue: 0 items requiring reminder")
            return

        lines: list[str] = [f"⚠️ <b>Просроченные доделки ({len(items)})</b>", ""]
        for it in items[:20]:  # ограничение чтобы не разрывать Telegram-сообщение
            days = (today_d - getdate(it["due_date"])).days
            assignee = it.get("assignee") or "—"
            urgency = it.get("urgency") or ""
            urgency_mark = "🔴 " if urgency == "Критично" else ""
            lines.append(
                f"• {urgency_mark}{it['name']} — {it['title']} "
                f"— отв. {assignee} — просрочено {days} {_days_word(days)}"
            )

        if len(items) > 20:
            lines.append(f"\n…и ещё {len(items) - 20}")

        text = "\n".join(lines)
        sent = send_message(text)

        # Обновляем next_reminder_sent чтобы не спамить ежедневно
        if sent:
            for it in items:
                frappe.db.set_value(
                    "Punch List Item", it["name"], "next_reminder_sent", str(today_d),
                    update_modified=False,
                )
            frappe.db.commit()

        frappe.logger().info(
            f"Punch List overdue: {len(items)} items — "
            f"{'отправлено' if sent else 'не отправлено (нет токена)'}"
        )

    except Exception:
        frappe.log_error(frappe.get_traceback(), "check_punch_list_overdue")


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


# ────────────────────────────── Daily director digest ───────────────────────


def _collect_hot_tenders() -> list[str]:
    """Тендеры с дедлайном ≤ 3 дня и активным статусом."""
    try:
        today = getdate(nowdate())
        cutoff = add_days(today, 3)
        tenders = frappe.get_all(
            "Tender",
            filters={
                "deadline_date": ["between", [today, cutoff]],
                "status": ["in", list(STATUSES_ACTIVE)],
            },
            fields=["name", "title", "nmck", "deadline_date"],
            order_by="deadline_date asc",
        )
        lines: list[str] = []
        for t in tenders:
            dl = t.get("deadline_date")
            days_left = (getdate(dl) - today).days if dl else 0
            nmck = t.get("nmck") or 0
            nmck_fmt = f"{nmck / 1_000_000:.1f} млн ₽" if nmck else "—"
            title = (t.get("title") or "").strip() or "—"
            if len(title) > 60:
                title = title[:57] + "…"
            days_word = _days_word(days_left) if days_left > 0 else "сегодня"
            days_part = f"{days_left} {days_word}" if days_left > 0 else "сегодня"
            lines.append(f"• {t['name']} — {title} — {days_part} / {nmck_fmt}")
        return lines
    except Exception:
        frappe.logger().warning(
            f"digest _collect_hot_tenders failed: {frappe.get_traceback()}"
        )
        return []


def _collect_red_evm() -> list[str]:
    """Проекты с последним EVM Snapshot в красной зоне."""
    try:
        if not frappe.db.exists("DocType", "EVM Snapshot"):
            return []
        today = getdate(nowdate())
        yesterday = add_days(today, -1)
        # Берём последний снимок на проект (LATEST per project), при условии что
        # его дата вчера/сегодня и health_level в красной зоне.
        rows = frappe.db.sql(
            """SELECT s.project, s.cpi, s.spi, s.health_level, s.snapshot_date
               FROM `tabEVM Snapshot` s
               INNER JOIN (
                   SELECT project, MAX(snapshot_date) AS max_date
                   FROM `tabEVM Snapshot`
                   GROUP BY project
               ) latest
                 ON latest.project = s.project
                AND latest.max_date = s.snapshot_date
               WHERE s.snapshot_date IN (%s, %s)
                 AND s.health_level IN ('warning', 'critical', 'disaster')
               ORDER BY FIELD(s.health_level, 'disaster', 'critical', 'warning'),
                        s.project ASC""",
            (str(yesterday), str(today)),
            as_dict=True,
        )
        labels = {
            "warning": "warning",
            "critical": "critical",
            "disaster": "disaster",
        }
        lines: list[str] = []
        for r in rows:
            cpi = flt(r.get("cpi") or 0)
            spi = flt(r.get("spi") or 0)
            label = labels.get(r.get("health_level"), r.get("health_level") or "—")
            lines.append(
                f"• {r['project']} — CPI {cpi:.2f} / SPI {spi:.2f} — {label}"
            )
        return lines
    except Exception:
        frappe.logger().warning(
            f"digest _collect_red_evm failed: {frappe.get_traceback()}"
        )
        return []


def _collect_overdue_meeting_items() -> list[str]:
    """Просроченные поручения с планёрок."""
    try:
        if not frappe.db.exists("DocType", "Meeting Item"):
            return []
        today = getdate(nowdate())
        rows = frappe.db.sql(
            """SELECT mi.topic, mi.responsible, mi.due_date, mi.status,
                      mi.parent, DATEDIFF(%s, mi.due_date) AS days_overdue
               FROM `tabMeeting Item` mi
               INNER JOIN `tabMeeting` m ON m.name = mi.parent
               WHERE mi.parenttype = 'Meeting'
                 AND mi.status IN ('Открыто', 'В работе')
                 AND mi.due_date IS NOT NULL
                 AND mi.due_date < %s
               ORDER BY mi.due_date ASC
               LIMIT 10""",
            (str(today), str(today)),
            as_dict=True,
        )
        lines: list[str] = []
        for r in rows:
            topic = (r.get("topic") or "").strip() or "—"
            if len(topic) > 60:
                topic = topic[:57] + "…"
            resp = (r.get("responsible") or "").strip() or "—"
            days = int(r.get("days_overdue") or 0)
            days_word = _days_word(days) if days > 0 else "день"
            lines.append(
                f"• {topic} — отв. {resp} — просрочено {days} {days_word}"
            )
        return lines
    except Exception:
        frappe.logger().warning(
            f"digest _collect_overdue_meeting_items failed: {frappe.get_traceback()}"
        )
        return []


def _collect_expiring_certs() -> list[str]:
    """Аттестации с истечением в ближайшие 30 дней."""
    try:
        if not frappe.db.exists("DocType", "Employee Certification"):
            return []
        today = getdate(nowdate())
        cutoff = add_days(today, 30)
        rows = frappe.get_all(
            "Employee Certification",
            filters={
                "expiry_date": ["between", [today, cutoff]],
                "status": ["!=", "Архив"],
            },
            fields=["employee_name", "cert_type", "expiry_date"],
            order_by="expiry_date asc",
            limit=15,
        )
        lines: list[str] = []
        for r in rows:
            emp = (r.get("employee_name") or "—").strip()
            cert = (r.get("cert_type") or "—").strip()
            exp = r.get("expiry_date")
            exp_fmt = getdate(exp).strftime("%d.%m.%Y") if exp else "—"
            lines.append(f"• {emp} — {cert} до {exp_fmt}")
        return lines
    except Exception:
        frappe.logger().warning(
            f"digest _collect_expiring_certs failed: {frappe.get_traceback()}"
        )
        return []


def _collect_stuck_material_requests() -> list[str]:
    """Заявки со статусом «Закупается» поданные ≥ 14 дней назад."""
    try:
        if not frappe.db.exists("DocType", "Material Request"):
            return []
        today = getdate(nowdate())
        cutoff = add_days(today, -14)
        rows = frappe.db.sql(
            """SELECT name, title, creation,
                      DATEDIFF(%s, DATE(creation)) AS days_old
               FROM `tabMaterial Request`
               WHERE status = 'Закупается'
                 AND DATE(creation) <= %s
               ORDER BY creation ASC
               LIMIT 10""",
            (str(today), str(cutoff)),
            as_dict=True,
        )
        lines: list[str] = []
        for r in rows:
            title = (r.get("title") or "").strip() or "—"
            if len(title) > 60:
                title = title[:57] + "…"
            days = int(r.get("days_old") or 0)
            days_word = _days_word(days)
            lines.append(f"• {r['name']} — {title} — {days} {days_word} с подачи")
        return lines
    except Exception:
        frappe.logger().warning(
            f"digest _collect_stuck_material_requests failed: {frappe.get_traceback()}"
        )
        return []


@frappe.whitelist()
def send_daily_director_digest() -> dict:
    """Daily 09:00 МСК: собирает утреннюю Telegram-сводку для директора.

    Возвращает dict с информацией о том, что было собрано и отправлено
    (полезно для ручного тестирования через API).
    """
    today = getdate(nowdate())
    today_fmt = today.strftime("%d.%m.%Y")

    sections: list[tuple[str, list[str]]] = [
        ("🔥 <b>Горящие тендеры</b>", _collect_hot_tenders()),
        ("📉 <b>Проекты в красной зоне EVM</b>", _collect_red_evm()),
        ("📋 <b>Просроченные поручения с планёрок</b>", _collect_overdue_meeting_items()),
        ("⏰ <b>Аттестации к продлению</b>", _collect_expiring_certs()),
        ("📦 <b>Заявки в работе на склад</b>", _collect_stuck_material_requests()),
    ]

    counts = {
        "hot_tenders": len(sections[0][1]),
        "red_evm": len(sections[1][1]),
        "overdue_meeting_items": len(sections[2][1]),
        "expiring_certs": len(sections[3][1]),
        "stuck_material_requests": len(sections[4][1]),
    }

    chat_id = os.getenv("TELEGRAM_DIRECTOR_CHAT_ID") or frappe.conf.get(
        "telegram_director_chat_id"
    )

    if not any(lines for _label, lines in sections):
        text = (
            f"<b>📊 Сводка на {today_fmt}</b>\n\n"
            f"✓ Утро тихое. Горящих задач нет."
        )
        sent = send_message(text, chat_id=chat_id)
        frappe.logger().info(
            f"director digest ({today_fmt}): empty — "
            f"{'отправлено' if sent else 'не отправлено'}"
        )
        return {"ok": True, "empty": True, "sent": sent, "counts": counts}

    parts: list[str] = [f"<b>📊 Сводка на {today_fmt}</b>"]
    for label, lines in sections:
        if not lines:
            continue
        parts.append("")
        parts.append(label)
        parts.extend(lines)

    text = "\n".join(parts)
    sent = send_message(text, chat_id=chat_id)
    frappe.logger().info(
        f"director digest ({today_fmt}): "
        f"hot={counts['hot_tenders']} evm={counts['red_evm']} "
        f"meeting={counts['overdue_meeting_items']} certs={counts['expiring_certs']} "
        f"mr={counts['stuck_material_requests']} — "
        f"{'отправлено' if sent else 'не отправлено'}"
    )
    return {"ok": True, "empty": False, "sent": sent, "counts": counts}


# ────────────────────────────── Helpers ─────────────────────────────────────


def _days_word(n: int) -> str:
    if n == 1:
        return "день"
    if 2 <= n <= 4:
        return "дня"
    return "дней"


# ────────────────────── Auto-rollover незавершённых работ ────────────────────


def rollover_unfinished_work() -> dict:
    """Weekly (вечер воскресенья): незакрытые работы прошлой недели переезжают в следующую.

    Идея — Linear Cycles auto-rollover.
    Что переносим:
    - Schedule Task с status IN ('Запланирована','В работе') и end_date < сегодня:
        * end_date переносится на (старая end_date + 7 дней)
        * в комментарий добавляется метка "rolled over from {old_date}"
    - Punch List Item с status IN ('Открыто','В работе') и due_date < сегодня:
        * due_date += 7 дней
        * в solution_notes добавляется "[ROLLOVER N: prev due {old_date}]"

    Итог сводки → Telegram директору.
    """
    today_d = getdate()
    rolled_tasks: list[dict] = []
    rolled_punch: list[dict] = []

    # Schedule Task
    try:
        if frappe.db.exists("DocType", "Schedule Task"):
            stuck = frappe.db.sql("""
                SELECT name, title, project, end_date, status
                FROM `tabSchedule Task`
                WHERE status IN ('Запланирована', 'В работе')
                  AND end_date IS NOT NULL
                  AND end_date < %(today)s
                ORDER BY end_date ASC
                LIMIT 200
            """, {"today": str(today_d)}, as_dict=True)

            for t in stuck:
                old_end = getdate(t["end_date"])
                new_end = old_end + timedelta(days=7)
                frappe.db.set_value(
                    "Schedule Task", t["name"], "end_date", str(new_end),
                    update_modified=False,
                )
                frappe.get_doc({
                    "doctype": "Comment",
                    "comment_type": "Info",
                    "reference_doctype": "Schedule Task",
                    "reference_name": t["name"],
                    "content": f"⏩ Auto-rollover: дедлайн перенесён с {old_end} на {new_end}",
                }).insert(ignore_permissions=True)
                rolled_tasks.append({
                    "name": t["name"], "title": t["title"],
                    "project": t["project"], "old_end": str(old_end), "new_end": str(new_end),
                })
            frappe.db.commit()
    except Exception:
        frappe.log_error(frappe.get_traceback(), "rollover_unfinished_work.schedule_task")

    # Punch List Item
    try:
        if frappe.db.exists("DocType", "Punch List Item"):
            stuck = frappe.db.sql("""
                SELECT name, title, project, due_date, urgency, solution_notes
                FROM `tabPunch List Item`
                WHERE status IN ('Открыто', 'В работе')
                  AND due_date IS NOT NULL
                  AND due_date < %(today)s
                ORDER BY due_date ASC
                LIMIT 200
            """, {"today": str(today_d)}, as_dict=True)

            for p in stuck:
                old_due = getdate(p["due_date"])
                new_due = old_due + timedelta(days=7)
                marker = f"[ROLLOVER {today_d}: prev due {old_due}]"
                new_notes = (p.get("solution_notes") or "").strip()
                if marker not in new_notes:
                    new_notes = (marker + "\n" + new_notes).strip()
                frappe.db.set_value(
                    "Punch List Item", p["name"], "due_date", str(new_due),
                    update_modified=False,
                )
                frappe.db.set_value(
                    "Punch List Item", p["name"], "solution_notes", new_notes[:2000],
                    update_modified=False,
                )
                rolled_punch.append({
                    "name": p["name"], "title": p["title"], "project": p["project"],
                    "old_due": str(old_due), "new_due": str(new_due),
                    "urgency": p.get("urgency"),
                })
            frappe.db.commit()
    except Exception:
        frappe.log_error(frappe.get_traceback(), "rollover_unfinished_work.punch_list")

    total = len(rolled_tasks) + len(rolled_punch)
    if total == 0:
        frappe.logger().info("rollover_unfinished_work: nothing to roll over")
        return {"ok": True, "total": 0, "tasks": 0, "punch": 0}

    # Telegram-сводка
    lines = [f"⏩ <b>Auto-rollover: перенесено {total} элементов на след. неделю</b>", ""]

    if rolled_tasks:
        lines.append(f"<b>Работы графика ({len(rolled_tasks)}):</b>")
        for t in rolled_tasks[:10]:
            lines.append(f"• {t['title']} ({t['project']}) — {t['old_end']} → {t['new_end']}")
        if len(rolled_tasks) > 10:
            lines.append(f"…и ещё {len(rolled_tasks) - 10}")
        lines.append("")

    if rolled_punch:
        lines.append(f"<b>Доделки ({len(rolled_punch)}):</b>")
        for p in rolled_punch[:10]:
            crit = "🔴 " if p.get("urgency") == "Критично" else ""
            lines.append(f"• {crit}{p['title']} ({p['project']}) — {p['old_due']} → {p['new_due']}")
        if len(rolled_punch) > 10:
            lines.append(f"…и ещё {len(rolled_punch) - 10}")

    send_message("\n".join(lines))
    frappe.logger().info(
        f"rollover_unfinished_work: rolled {len(rolled_tasks)} tasks + {len(rolled_punch)} punch items"
    )
    return {"ok": True, "total": total, "tasks": len(rolled_tasks), "punch": len(rolled_punch)}
