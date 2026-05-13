"""API для Change Orders — изменений scope в ходе проекта.

Workflow: Черновик → На согласовании → Одобрен / Отклонён → Закрыт
"""
from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import flt, today

VALID_STATUSES = ("Черновик", "На согласовании", "Одобрен", "Отклонён", "Закрыт")


@frappe.whitelist()
def get_list(project: str | None = None, status: str | None = None) -> list[dict]:
    """Список Change Orders с фильтрами."""
    frappe.has_permission("Change Order", throw=True)

    filters: dict = {}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status

    return frappe.get_all(
        "Change Order",
        filters=filters,
        fields=[
            "name", "title", "status", "project",
            "reason_category", "variation_type",
            "request_date", "submitted_at", "approved_at", "rejected_at",
            "contractor_amount", "engineer_amount", "approved_amount",
            "schedule_impact_days",
        ],
        order_by="request_date desc",
        limit=200,
    )


@frappe.whitelist()
def get_detail(name: str) -> dict:
    """Change Order с позициями."""
    frappe.has_permission("Change Order", "read", throw=True)
    doc = frappe.get_doc("Change Order", name)
    return doc.as_dict()


@frappe.whitelist()
def save_change_order(data: dict) -> dict:
    """Создать или обновить Change Order (upsert по name)."""
    frappe.has_permission("Change Order", "create", throw=True)

    name = data.get("name")
    if name and frappe.db.exists("Change Order", name):
        doc = frappe.get_doc("Change Order", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"updated": doc.name}

    doc = frappe.get_doc({"doctype": "Change Order", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"created": doc.name}


@frappe.whitelist()
def set_status(name: str, status: str, approved_by: str | None = None, rejected_by: str | None = None) -> dict:
    """Сменить статус Change Order. Авто-проставляет даты и FIO согласующего/отклоняющего."""
    frappe.has_permission("Change Order", "write", throw=True)

    if status not in VALID_STATUSES:
        frappe.throw(_(f"Недопустимый статус: {status}"))

    doc = frappe.get_doc("Change Order", name)
    doc.status = status

    if status == "На согласовании" and not doc.submitted_at:
        doc.submitted_at = today()
        doc.submitted_by = frappe.session.user

    if status == "Одобрен":
        doc.approved_at = today()
        if approved_by:
            doc.approved_by = approved_by
        if not flt(doc.approved_amount) and flt(doc.contractor_amount):
            doc.approved_amount = doc.contractor_amount

    if status == "Отклонён":
        doc.rejected_at = today()
        if rejected_by:
            doc.rejected_by = rejected_by

    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "name": name, "status": status}


@frappe.whitelist()
def get_stats(project: str | None = None) -> dict:
    """Статистика по Change Orders (для дашборда / карточки проекта).

    Возвращает:
    - total — всего
    - draft / submitted / approved / rejected — по статусам
    - approved_total — сумма всех одобренных
    - pending_total — сумма в работе (на согласовании)
    - schedule_impact_days — итоговое влияние на срок
    """
    filters = {"project": project} if project else {}

    all_cos = frappe.get_all(
        "Change Order",
        filters=filters,
        fields=["status", "contractor_amount", "approved_amount", "schedule_impact_days"],
    )

    stats = {
        "total": len(all_cos),
        "draft": 0,
        "submitted": 0,
        "approved": 0,
        "rejected": 0,
        "closed": 0,
        "approved_total": 0.0,
        "pending_total": 0.0,
        "schedule_impact_days": 0,
    }

    status_map = {
        "Черновик": "draft",
        "На согласовании": "submitted",
        "Одобрен": "approved",
        "Отклонён": "rejected",
        "Закрыт": "closed",
    }

    for co in all_cos:
        key = status_map.get(co.status, "draft")
        stats[key] += 1
        if co.status == "Одобрен":
            stats["approved_total"] += flt(co.approved_amount or co.contractor_amount)
            stats["schedule_impact_days"] += int(co.schedule_impact_days or 0)
        elif co.status == "На согласовании":
            stats["pending_total"] += flt(co.contractor_amount)

    return stats
