from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate, add_days


@frappe.whitelist()
def get_list(status: str = "", customer: str = "") -> list:
    filters = {}
    if status:
        filters["status"] = status
    if customer:
        filters["customer"] = customer

    projects = frappe.get_all(
        "Construction Project",
        filters=filters,
        fields=[
            "name", "title", "status", "customer", "tender", "estimate",
            "work_type", "location", "contract_amount", "planned_cost",
            "planned_margin_pct", "start_date", "planned_end_date",
            "actual_end_date", "foreman",
        ],
        order_by="modified desc",
    )

    today = getdate(nowdate())
    for p in projects:
        # КС-2 по проекту
        ks2_signed = frappe.db.sql(
            """SELECT COALESCE(SUM(amount),0) as total,
                      COALESCE(SUM(payment_received),0) as paid
               FROM `tabKS2 Act`
               WHERE project=%s AND status='Подписан'""",
            p["name"],
            as_dict=True,
        )
        p["ks2_signed"] = flt(ks2_signed[0]["total"]) if ks2_signed else 0
        p["ks2_paid"] = flt(ks2_signed[0]["paid"]) if ks2_signed else 0

        # % выполнения = подписанные КС-2 / контракт
        if p.get("contract_amount"):
            p["progress_pct"] = min(100, round(flt(p["ks2_signed"]) / flt(p["contract_amount"]) * 100))
        else:
            p["progress_pct"] = 0

        # Снабжение по проекту
        supply_total = frappe.db.sql(
            """SELECT COALESCE(SUM(total_estimated),0)
               FROM `tabMaterial Request`
               WHERE project=%s AND status IN ('Одобрена','Закупается','Получена')""",
            p["name"],
        )
        p["supply_total"] = flt(supply_total[0][0] if supply_total else 0)

        # Дни до сдачи
        if p.get("planned_end_date") and p.get("status") not in ("Закрыт", "Отменён"):
            p["days_left"] = (getdate(p["planned_end_date"]) - today).days
        else:
            p["days_left"] = None

        # Открытые инциденты
        p["open_incidents"] = frappe.db.count(
            "Safety Incident",
            {"project": p["name"], "status": ["in", ["Открыт", "В работе"]]},
        )

    return projects


@frappe.whitelist()
def get_detail(name: str) -> dict:
    project = frappe.get_doc("Construction Project", name)
    today = getdate(nowdate())

    # КС-2 по проекту
    ks2_acts = frappe.get_all(
        "KS2 Act",
        filters={"project": name},
        fields=["name", "title", "amount", "payment_received", "status", "payment_status", "act_date", "payment_due_date"],
        order_by="act_date desc",
    )
    ks2_signed_total = sum(flt(a["amount"]) for a in ks2_acts if a["status"] == "Подписан")
    ks2_paid_total = sum(flt(a.get("payment_received", 0)) for a in ks2_acts if a["status"] == "Подписан")
    ks2_debt = ks2_signed_total - ks2_paid_total

    # Снабжение
    supply = frappe.get_all(
        "Material Request",
        filters={"project": name},
        fields=["name", "title", "status", "total_estimated", "needed_by_date"],
        order_by="modified desc",
    )
    supply_total = sum(flt(s.get("total_estimated", 0)) for s in supply if s["status"] in ("Одобрена", "Закупается", "Получена"))

    # Техника
    equipment = frappe.get_all(
        "Equipment",
        filters={"project": name},
        fields=["name", "equipment_name", "category", "status", "next_maintenance_date"],
    )

    # Отчёты прорабов (последние 10)
    reports = frappe.get_all(
        "Foreman Report",
        filters={"project": name},
        fields=["name", "title", "report_date", "workers_count", "status", "has_safety_incident"],
        order_by="report_date desc",
        limit=10,
    )

    # Инциденты
    incidents = frappe.get_all(
        "Safety Incident",
        filters={"project": name},
        fields=["name", "title", "severity", "status", "incident_date"],
        order_by="incident_date desc",
    )

    # Смета — позиции и общая сумма
    estimate_data = None
    if project.estimate:
        est = frappe.get_doc("Estimate", project.estimate)
        estimate_data = {
            "name": est.name,
            "title": est.title,
            "total_cost": flt(getattr(est, "base_total", 0) or 0),
            "total_price": flt(getattr(est, "our_total", 0) or 0),
            "margin_pct": flt(getattr(est, "margin_pct", 0) or 0),
        }

    # Тендер
    tender_data = None
    if project.tender:
        tender = frappe.get_doc("Tender", project.tender)
        tender_data = {
            "name": tender.name,
            "title": tender.title,
            "status": tender.status,
            "our_price": flt(tender.our_price or 0),
            "nmck": flt(tender.nmck or 0),
        }

    # План/факт маржа
    plan_revenue = flt(project.contract_amount or 0)
    plan_cost = flt(project.planned_cost or 0)
    plan_margin = plan_revenue - plan_cost
    plan_margin_pct = (plan_margin / plan_revenue * 100) if plan_revenue else 0

    fact_revenue = ks2_signed_total
    fact_cost = supply_total
    fact_margin = fact_revenue - fact_cost
    fact_margin_pct = (fact_margin / fact_revenue * 100) if fact_revenue else 0

    # % выполнения
    progress_pct = min(100, round(ks2_signed_total / plan_revenue * 100)) if plan_revenue else 0

    # Дни до сдачи
    days_left = None
    if project.planned_end_date and project.status not in ("Закрыт", "Отменён"):
        days_left = (getdate(project.planned_end_date) - today).days

    return {
        "name": project.name,
        "title": project.title,
        "status": project.status,
        "customer": project.customer,
        "work_type": project.work_type,
        "location": project.location,
        "contract_number": project.contract_number,
        "contract_amount": flt(project.contract_amount or 0),
        "planned_cost": flt(project.planned_cost or 0),
        "planned_margin_pct": flt(project.planned_margin_pct or 0),
        "start_date": str(project.start_date) if project.start_date else None,
        "planned_end_date": str(project.planned_end_date) if project.planned_end_date else None,
        "actual_end_date": str(project.actual_end_date) if project.actual_end_date else None,
        "foreman": project.foreman,
        "description": project.description,
        "notes": project.notes,
        "tender_ref": project.tender,
        "estimate_ref": project.estimate,
        # Метрики
        "progress_pct": progress_pct,
        "days_left": days_left,
        # План/факт
        "margin": {
            "plan_revenue": plan_revenue,
            "plan_cost": plan_cost,
            "plan_margin": plan_margin,
            "plan_margin_pct": flt(plan_margin_pct, 2),
            "fact_revenue": fact_revenue,
            "fact_cost": fact_cost,
            "fact_margin": fact_margin,
            "fact_margin_pct": flt(fact_margin_pct, 2),
            "ks2_debt": ks2_debt,
        },
        # Связанные сущности
        "tender": tender_data,
        "estimate": estimate_data,
        "ks2_acts": ks2_acts,
        "supply": supply,
        "equipment": equipment,
        "reports": reports,
        "incidents": incidents,
    }


@frappe.whitelist()
def save_project(data: dict) -> dict:
    if isinstance(data, str):
        import json
        data = json.loads(data)

    name = data.get("name")
    if name and frappe.db.exists("Construction Project", name):
        doc = frappe.get_doc("Construction Project", name)
        doc.update(data)
    else:
        doc = frappe.new_doc("Construction Project")
        doc.update(data)

    doc.save(ignore_permissions=True)
    return {"name": doc.name}


@frappe.whitelist()
def set_status(name: str, status: str) -> dict:
    frappe.db.set_value("Construction Project", name, "status", status)
    if status == "Закрыт":
        frappe.db.set_value("Construction Project", name, "actual_end_date", nowdate())
    return {"ok": True}


@frappe.whitelist()
def create_from_tender(tender_name: str) -> dict:
    """Создать проект на основе выигранного тендера."""
    tender = frappe.get_doc("Tender", tender_name)

    existing = frappe.db.exists("Construction Project", {"tender": tender_name})
    if existing:
        return {"name": existing, "existed": True}

    project = frappe.new_doc("Construction Project")
    project.title = tender.title or tender.name
    project.status = "Подготовка"
    project.customer = tender.customer
    project.tender = tender_name
    project.work_type = tender.work_type
    project.contract_amount = flt(tender.our_price or tender.nmck or 0)
    project.start_date = nowdate()
    project.description = f"Проект на основе тендера {tender_name}"
    project.insert(ignore_permissions=True)
    return {"name": project.name, "existed": False}


@frappe.whitelist()
def get_stats() -> dict:
    today = getdate(nowdate())

    by_status = frappe.db.sql(
        """SELECT status, COUNT(*) as cnt, COALESCE(SUM(contract_amount),0) as total
           FROM `tabConstruction Project` GROUP BY status""",
        as_dict=True,
    )

    active = sum(r["cnt"] for r in by_status if r["status"] in ("Подготовка", "В работе", "Сдача"))
    active_amount = sum(flt(r["total"]) for r in by_status if r["status"] in ("Подготовка", "В работе", "Сдача"))

    closed = sum(r["cnt"] for r in by_status if r["status"] == "Закрыт")
    closed_amount = sum(flt(r["total"]) for r in by_status if r["status"] == "Закрыт")

    deadline_warn = frappe.db.sql(
        """SELECT name, title, planned_end_date, customer
           FROM `tabConstruction Project`
           WHERE status IN ('Подготовка','В работе','Сдача')
             AND planned_end_date IS NOT NULL
             AND planned_end_date <= DATE_ADD(%s, INTERVAL 14 DAY)
           ORDER BY planned_end_date ASC""",
        str(today),
        as_dict=True,
    )

    return {
        "active": active,
        "active_amount": flt(active_amount),
        "closed": closed,
        "closed_amount": flt(closed_amount),
        "by_status": by_status,
        "deadline_warn": deadline_warn,
    }
