"""API для User View — сохранённые фильтры по страницам (как у Linear)."""
from __future__ import annotations

import json

import frappe


@frappe.whitelist()
def get_views(route: str | None = None) -> list[dict]:
    """Список сохранённых view для текущего пользователя + расшаренные."""
    frappe.has_permission("User View", throw=True)
    user = frappe.session.user
    filters = []
    if route:
        filters.append(["route", "=", route])

    # Свои + расшаренные команде
    rows = frappe.db.sql(
        f"""SELECT name, view_name, route, user_email, is_shared, is_pinned,
                   filters_json, sort_field, sort_order, modified
            FROM `tabUser View`
            WHERE (user_email = %(u)s OR is_shared = 1)
              { "AND route = %(r)s" if route else "" }
            ORDER BY is_pinned DESC, modified DESC""",
        {"u": user, "r": route or ""}, as_dict=True,
    )
    for r in rows:
        try:
            r["filters"] = json.loads(r.get("filters_json") or "{}")
        except (json.JSONDecodeError, TypeError):
            r["filters"] = {}
        r["is_own"] = r["user_email"] == user
    return rows


@frappe.whitelist()
def save_view(view_name: str, route: str, filters: dict | str | None = None,
              sort_field: str | None = None, sort_order: str = "DESC",
              is_shared: int | bool = 0, is_pinned: int | bool = 0,
              update_name: str | None = None) -> dict:
    """Создать или обновить view.

    update_name: если задано — обновляем существующий view, иначе создаём новый.
    """
    if isinstance(filters, dict):
        filters_str = json.dumps(filters, ensure_ascii=False)
    elif isinstance(filters, str):
        filters_str = filters
    else:
        filters_str = "{}"

    if update_name and frappe.db.exists("User View", update_name):
        doc = frappe.get_doc("User View", update_name)
        # Проверка владельца (только свой view или System Manager)
        if doc.user_email != frappe.session.user and \
           "System Manager" not in frappe.get_roles(frappe.session.user):
            frappe.throw("Нельзя редактировать чужой view")
        doc.view_name = view_name
        doc.route = route
        doc.filters_json = filters_str
        doc.sort_field = sort_field
        doc.sort_order = sort_order
        doc.is_shared = 1 if int(is_shared or 0) else 0
        doc.is_pinned = 1 if int(is_pinned or 0) else 0
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"name": doc.name, "updated": True}

    doc = frappe.get_doc({
        "doctype": "User View",
        "view_name": view_name,
        "route": route,
        "filters_json": filters_str,
        "sort_field": sort_field,
        "sort_order": sort_order or "DESC",
        "is_shared": 1 if int(is_shared or 0) else 0,
        "is_pinned": 1 if int(is_pinned or 0) else 0,
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "created": True}


@frappe.whitelist()
def delete_view(name: str) -> dict:
    if not frappe.db.exists("User View", name):
        return {"ok": True, "deleted": name}
    owner = frappe.db.get_value("User View", name, "user_email")
    if owner != frappe.session.user and \
       "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Нельзя удалить чужой view")
    frappe.delete_doc("User View", name, ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "deleted": name}
