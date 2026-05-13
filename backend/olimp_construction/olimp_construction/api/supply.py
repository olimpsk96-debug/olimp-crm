from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import flt

VALID_STATUSES = ("Черновик", "Отправлена", "Одобрена", "Закупается", "Получена", "Отменена")
VALID_PRIORITIES = ("Обычная", "Срочная", "Критическая")


@frappe.whitelist()
def get_list(project: str | None = None, status: str | None = None) -> list[dict]:
    """Список заявок на материалы."""
    frappe.has_permission("Material Request", throw=True)

    filters: dict = {}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status

    return frappe.get_all(
        "Material Request",
        filters=filters,
        fields=[
            "name", "title", "status", "priority",
            "project", "requested_by",
            "request_date", "needed_by_date",
            "total_estimated",
        ],
        order_by="needed_by_date asc, modified desc",
        limit=200,
    )


@frappe.whitelist()
def get_detail(name: str) -> dict:
    """Заявка со всеми позициями."""
    frappe.has_permission("Material Request", "read", throw=True)
    doc = frappe.get_doc("Material Request", name)
    return doc.as_dict()


@frappe.whitelist()
def save_request(data: dict) -> dict:
    """Создать или обновить заявку (upsert по name)."""
    frappe.has_permission("Material Request", "create", throw=True)

    name = data.get("name")
    if name and frappe.db.exists("Material Request", name):
        doc = frappe.get_doc("Material Request", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"updated": doc.name}

    doc = frappe.get_doc({"doctype": "Material Request", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"created": doc.name}


@frappe.whitelist()
def set_status(name: str, status: str) -> dict:
    """Меняет статус заявки."""
    frappe.has_permission("Material Request", "write", throw=True)

    if status not in VALID_STATUSES:
        frappe.throw(_(f"Недопустимый статус: {status}"))

    frappe.db.set_value("Material Request", name, "status", status)
    frappe.db.commit()
    return {"ok": True, "name": name, "status": status}
