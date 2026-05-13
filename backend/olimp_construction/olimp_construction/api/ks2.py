from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import flt, today

VALID_STATUSES = ("Черновик", "На подписании", "Подписан", "Отклонён")
VALID_PAYMENT = ("Ожидает", "Частично", "Оплачено")


@frappe.whitelist()
def get_list(project: str | None = None, status: str | None = None) -> list[dict]:
    """Список КС-2 с фильтрами."""
    frappe.has_permission("KS2 Act", throw=True)

    filters: dict = {}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status

    return frappe.get_all(
        "KS2 Act",
        filters=filters,
        fields=[
            "name", "title", "status", "act_number",
            "project", "customer", "contract_number",
            "act_date", "period_from", "period_to", "signed_date",
            "amount", "payment_status", "payment_received", "payment_due_date",
        ],
        order_by="act_date desc",
        limit=200,
    )


@frappe.whitelist()
def get_detail(name: str) -> dict:
    """КС-2 со всеми позициями."""
    frappe.has_permission("KS2 Act", "read", throw=True)
    doc = frappe.get_doc("KS2 Act", name)
    return doc.as_dict()


@frappe.whitelist()
def save_act(data: dict) -> dict:
    """Создать или обновить КС-2 (upsert)."""
    frappe.has_permission("KS2 Act", "create", throw=True)

    name = data.get("name")
    if name and frappe.db.exists("KS2 Act", name):
        doc = frappe.get_doc("KS2 Act", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"updated": doc.name}

    doc = frappe.get_doc({"doctype": "KS2 Act", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"created": doc.name}


@frappe.whitelist()
def set_status(name: str, status: str) -> dict:
    """Меняет статус КС-2."""
    frappe.has_permission("KS2 Act", "write", throw=True)

    if status not in VALID_STATUSES:
        frappe.throw(_(f"Недопустимый статус: {status}"))

    update = {"status": status}
    if status == "Подписан":
        update["signed_date"] = today()

    for field, value in update.items():
        frappe.db.set_value("KS2 Act", name, field, value)
    frappe.db.commit()
    return {"ok": True, "name": name, "status": status}


@frappe.whitelist()
def import_from_estimate(estimate_name: str) -> list[dict]:
    """Возвращает позиции сметы для заполнения КС-2 (не создаёт акт, только данные)."""
    frappe.has_permission("Estimate", "read", throw=True)

    if not frappe.db.exists("Estimate", estimate_name):
        frappe.throw(_(f"Смета {estimate_name} не найдена"))

    doc = frappe.get_doc("Estimate", estimate_name)
    items = []
    for item in doc.items or []:
        if item.is_section:
            continue
        items.append({
            "work_name": item.item_name,
            "unit": item.unit or "",
            "qty": flt(item.qty),
            "unit_price": flt(item.our_unit_price or item.base_unit_price),
            "amount": flt(item.our_amount or item.base_amount),
            "estimate_ref": item.name,
        })
    return items
