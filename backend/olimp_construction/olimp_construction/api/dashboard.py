from __future__ import annotations

import frappe
from frappe.utils import flt, getdate, nowdate, add_days, now_datetime

from olimp_construction.telegram_utils import STATUSES_ACTIVE


@frappe.whitelist()
def get_command_center() -> dict:
    today = getdate(nowdate())
    warn7 = add_days(today, 7)
    warn3 = add_days(today, 3)
    month_start = today.strftime("%Y-%m-01")

    # ── Cashflow ─────────────────────────────────────────────────────────────
    cash_balance = flt(frappe.db.get_default("olimp_cash_balance") or 0)

    ks2_debt = frappe.db.sql(
        """SELECT COALESCE(SUM(amount - IFNULL(payment_received,0)), 0)
           FROM `tabKS2 Act`
           WHERE status='Подписан' AND payment_status != 'Оплачено'""",
    )[0][0] or 0

    supply_planned = frappe.db.sql(
        """SELECT COALESCE(SUM(total_estimated), 0)
           FROM `tabMaterial Request`
           WHERE status IN ('Одобрена','Закупается')""",
    )[0][0] or 0

    # ── Тендеры ──────────────────────────────────────────────────────────────
    active_statuses = list(STATUSES_ACTIVE)
    tenders_active = frappe.db.count("Tender", {"status": ["in", active_statuses]})

    deadlines_3d = frappe.get_all(
        "Tender",
        filters={"status": ["in", active_statuses], "deadline_date": ["between", [str(today), str(warn3)]]},
        fields=["name", "title", "deadline_date", "nmck"],
        order_by="deadline_date asc",
        limit=3,
    )

    # ── КС-2 ─────────────────────────────────────────────────────────────────
    ks2_unpaid = frappe.get_all(
        "KS2 Act",
        filters={"status": "Подписан", "payment_status": ["!=", "Оплачено"]},
        fields=["name", "title", "amount", "payment_received", "payment_due_date", "customer"],
        order_by="payment_due_date asc",
        limit=5,
    )
    for a in ks2_unpaid:
        a["debt"] = flt(a.get("amount", 0)) - flt(a.get("payment_received", 0))
        if a.get("payment_due_date"):
            a["overdue"] = getdate(a["payment_due_date"]) < today
        else:
            a["overdue"] = False

    # ── Снабжение ─────────────────────────────────────────────────────────────
    supply_pending = frappe.get_all(
        "Material Request",
        filters={"status": ["in", ["Черновик", "Отправлена"]]},
        fields=["name", "title", "total_estimated", "needed_by_date"],
        order_by="needed_by_date asc",
        limit=3,
    )

    # ── ОТ/ТБ ────────────────────────────────────────────────────────────────
    open_incidents = frappe.get_all(
        "Safety Incident",
        filters={"status": ["in", ["Открыт", "В работе"]]},
        fields=["name", "title", "severity", "incident_date"],
        order_by="incident_date desc",
        limit=5,
    )

    workers_today = frappe.db.sql(
        "SELECT COALESCE(SUM(workers_count),0) FROM `tabForeman Report` WHERE report_date=%s",
        nowdate()
    )[0][0] or 0

    reports_today = frappe.db.count("Foreman Report", {"report_date": nowdate()})

    # ── Техника ──────────────────────────────────────────────────────────────
    equipment_due = frappe.get_all(
        "Equipment",
        filters={"status": ["!=", "Списана"], "next_maintenance_date": ["<=", str(warn7)]},
        fields=["name", "equipment_name", "next_maintenance_date", "status", "current_location"],
        order_by="next_maintenance_date asc",
        limit=5,
    )
    for eq in equipment_due:
        if eq.get("next_maintenance_date"):
            eq["days_left"] = (getdate(eq["next_maintenance_date"]) - today).days

    fuel_month = frappe.db.sql(
        "SELECT COALESCE(SUM(total_amount),0) FROM `tabFuel Log` WHERE fuel_date >= %s",
        month_start
    )[0][0] or 0

    # ── Проекты ───────────────────────────────────────────────────────────────
    active_projects = frappe.db.sql(
        """SELECT p.name, p.title, p.status, p.customer, p.contract_amount,
                  p.planned_end_date,
                  COALESCE((SELECT SUM(amount) FROM `tabKS2 Act`
                            WHERE project=p.name AND status='Подписан'), 0) as ks2_signed,
                  CASE WHEN p.planned_end_date IS NOT NULL
                       THEN DATEDIFF(p.planned_end_date, %s)
                       ELSE NULL END as days_left
           FROM `tabConstruction Project` p
           WHERE p.status IN ('Подготовка','В работе','Сдача')
           ORDER BY p.planned_end_date ASC
           LIMIT 5""",
        str(today),
        as_dict=True,
    )
    for ap in active_projects:
        if ap.get("contract_amount"):
            ap["progress_pct"] = min(100, round(flt(ap["ks2_signed"]) / flt(ap["contract_amount"]) * 100))
        else:
            ap["progress_pct"] = 0

    projects_total = frappe.db.count(
        "Construction Project",
        {"status": ["in", ["Подготовка", "В работе", "Сдача"]]},
    )

    # ── CRM ───────────────────────────────────────────────────────────────────
    next_actions = frappe.db.sql(
        """SELECT i.name, i.customer, c.customer_name, i.next_action, i.next_action_date,
                  CASE WHEN i.next_action_date < %s THEN 1 ELSE 0 END as overdue
           FROM `tabInteraction` i
           LEFT JOIN `tabCustomer` c ON c.name = i.customer
           WHERE i.next_action_date <= %s AND IFNULL(i.next_action, '') != ''
           ORDER BY i.next_action_date ASC
           LIMIT 5""",
        (str(today), str(add_days(today, 3))),
        as_dict=True,
    )

    deals_pipeline = frappe.db.sql(
        """SELECT status, COUNT(*) as cnt, COALESCE(SUM(amount_estimated),0) as total
           FROM `tabDeal`
           WHERE status NOT IN ('Закрыт выигран', 'Закрыт проигран')
           GROUP BY status""",
        as_dict=True,
    )
    pipeline_total = sum(flt(r["total"]) for r in deals_pipeline)
    active_deals = sum(r["cnt"] for r in deals_pipeline)

    total_clients = frappe.db.count("Customer")

    # ── Alerts ("что горит") ──────────────────────────────────────────────────
    alerts = []

    for na in next_actions:
        is_overdue = na.get("overdue")
        alerts.append({
            "type": "crm_followup",
            "severity": "critical" if is_overdue else "warning",
            "title": "Просроченная задача" if is_overdue else "Задача на сегодня",
            "body": f"{na.get('customer_name') or na['customer']}: {na['next_action']}",
            "link": "/clients",
            "meta": str(na.get("next_action_date", "")),
        })

    for t in deadlines_3d:
        days = (getdate(t["deadline_date"]) - today).days if t.get("deadline_date") else None
        alerts.append({
            "type": "tender_deadline",
            "severity": "critical" if days is not None and days <= 1 else "warning",
            "title": f"Дедлайн тендера {'сегодня!' if days == 0 else f'через {days}д' if days else ''}",
            "body": t.get("title", t["name"]),
            "link": "/tenders",
            "meta": f"НМЦК {_fmtm(t.get('nmck'))}",
        })

    for inc in open_incidents:
        sev = inc.get("severity", "")
        alerts.append({
            "type": "safety_incident",
            "severity": "critical" if sev in ("Тяжёлый", "Критический") else "warning",
            "title": f"Инцидент ОТ/ТБ — {sev}",
            "body": inc.get("title", ""),
            "link": "/safety",
            "meta": inc.get("incident_date", ""),
        })

    for eq in equipment_due:
        days = eq.get("days_left")
        if days is not None and days < 0:
            alerts.append({
                "type": "equipment_maintenance",
                "severity": "critical",
                "title": f"ТО просрочено на {abs(days)}д",
                "body": eq.get("equipment_name", eq["name"]),
                "link": "/equipment",
                "meta": eq.get("current_location") or "",
            })
        elif days is not None and days <= 3:
            alerts.append({
                "type": "equipment_maintenance",
                "severity": "warning",
                "title": f"ТО через {days}д",
                "body": eq.get("equipment_name", eq["name"]),
                "link": "/equipment",
                "meta": eq.get("current_location") or "",
            })

    for act in ks2_unpaid:
        if act.get("overdue"):
            alerts.append({
                "type": "payment_overdue",
                "severity": "critical",
                "title": "Просрочена оплата КС-2",
                "body": act.get("title", act["name"]),
                "link": "/ks2",
                "meta": _fmtm(act.get("debt")),
            })

    alerts.sort(key=lambda a: 0 if a["severity"] == "critical" else 1)

    return {
        "cashflow": {
            "balance": flt(cash_balance),
            "incoming": flt(ks2_debt),
            "outgoing": flt(supply_planned),
            "projected": flt(cash_balance) + flt(ks2_debt) - flt(supply_planned),
        },
        "tenders": {
            "active": tenders_active,
            "deadlines_3d": deadlines_3d,
        },
        "ks2": {
            "unpaid_acts": ks2_unpaid,
            "unpaid_total": flt(ks2_debt),
        },
        "supply": {
            "pending": supply_pending,
            "planned_total": flt(supply_planned),
        },
        "safety": {
            "open_incidents": open_incidents,
            "workers_today": int(workers_today),
            "reports_today": reports_today,
        },
        "equipment": {
            "maintenance_due": equipment_due,
            "fuel_month": flt(fuel_month),
        },
        "crm": {
            "total_clients": total_clients,
            "active_deals": active_deals,
            "pipeline_total": flt(pipeline_total),
            "next_actions": next_actions,
            "deals_pipeline": deals_pipeline,
        },
        "projects": {
            "active": projects_total,
            "list": active_projects,
        },
        "alerts": alerts,
        "updated_at": now_datetime().strftime("%d.%m.%Y %H:%M"),
    }


def _fmtm(v) -> str:
    if not v:
        return ""
    v = flt(v)
    if v >= 1_000_000:
        return f"{v / 1_000_000:.2f} млн ₽"
    if v >= 1000:
        return f"{v / 1000:.0f} тыс. ₽"
    return f"{v:.0f} ₽"
