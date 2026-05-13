"""API общего журнала работ (КС-6) — список, детали, добавление записи за день."""
from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import getdate, nowdate


@frappe.whitelist()
def get_list(project: str | None = None, status: str | None = None) -> list[dict]:
    """Список журналов."""
    frappe.has_permission("Work Log", throw=True)
    filters: dict = {}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status
    return frappe.get_all(
        "Work Log",
        filters=filters,
        fields=[
            "name", "title", "project", "status",
            "started_date", "finished_date",
            "customer_name", "contractor_responsible",
            "entries_count", "total_workers_days", "issues_count", "hidden_works_count",
        ],
        order_by="started_date desc",
        limit=200,
    )


@frappe.whitelist()
def get_detail(name: str) -> dict:
    """Журнал с записями."""
    frappe.has_permission("Work Log", "read", throw=True)
    doc = frappe.get_doc("Work Log", name)
    return doc.as_dict()


@frappe.whitelist()
def save_log(data: dict) -> dict:
    """Создать/обновить журнал."""
    frappe.has_permission("Work Log", "create", throw=True)
    name = data.get("name")
    if name and frappe.db.exists("Work Log", name):
        doc = frappe.get_doc("Work Log", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"updated": doc.name}
    doc = frappe.get_doc({"doctype": "Work Log", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"created": doc.name}


@frappe.whitelist()
def add_entry(log_name: str, entry: dict) -> dict:
    """Добавить запись за день в журнал."""
    frappe.has_permission("Work Log", "write", doc=log_name, throw=True)
    doc = frappe.get_doc("Work Log", log_name)
    doc.append("entries", entry)
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "log": log_name, "entries_count": doc.entries_count}


@frappe.whitelist()
def get_stats() -> dict:
    """Сводка по всем активным журналам."""
    frappe.has_permission("Work Log", throw=True)
    active = frappe.db.count("Work Log", {"status": "Ведётся"})
    closed = frappe.db.count("Work Log", {"status": ["in", ["Закрыт", "Передан заказчику"]]})

    today = getdate(nowdate())
    week_ago_str = str(today - frappe._dict({"days": 7}) if False else __import__("datetime").date.today() - __import__("datetime").timedelta(days=7))

    recent_entries = frappe.db.sql(
        """SELECT we.entry_date, we.workers_count, we.works_description, we.has_issues, we.hidden_works,
                  wl.title AS log_title, wl.project, wl.name AS log_name
           FROM `tabWork Log Entry` we
           JOIN `tabWork Log` wl ON wl.name = we.parent
           WHERE we.entry_date >= %s
           ORDER BY we.entry_date DESC LIMIT 10""",
        (week_ago_str,),
        as_dict=True,
    )

    return {
        "active_logs": active,
        "closed_logs": closed,
        "recent_entries": recent_entries,
    }
