"""API для модуля Punch List (список недоделок).

Эндпоинты:
- get_list — список с фильтрами (по умолчанию: просроченные сверху, потом критичные)
- get_stats — KPI: total, open, in_progress, done, overdue, critical
- save_item — создание / обновление
- set_status — смена статуса (auto-completed_date в before_save модели)
- get_overdue — только просроченные (для отчётов и cron-задач)
"""
from __future__ import annotations

import json

import frappe
from frappe.utils import flt, getdate, today


# Статусы, считающиеся «активной работой» (для overdue и critical)
ACTIVE_STATUSES = ("Открыто", "В работе")


# ── List / detail ────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_list(
    project: str | None = None,
    status: str | None = None,
    urgency: str | None = None,
    item_type: str | None = None,
) -> list[dict]:
    """Список Punch List Item с фильтрами.

    Сортировка: due_date ASC (просроченные/ближайшие сверху, NULL в конец),
    затем urgency по убыванию (Критично выше).
    """
    frappe.has_permission("Punch List Item", throw=True)

    where = ["1=1"]
    params: dict = {}
    if project:
        where.append("project = %(project)s")
        params["project"] = project
    if status:
        where.append("status = %(status)s")
        params["status"] = status
    if urgency:
        where.append("urgency = %(urgency)s")
        params["urgency"] = urgency
    if item_type:
        where.append("item_type = %(item_type)s")
        params["item_type"] = item_type

    where_clause = " AND ".join(where)

    # frappe.get_all не пропускает CASE в order_by → используем сырой SQL.
    # Параметры через %(...)s — никаких пользовательских значений в самой строке.
    rows = frappe.db.sql(
        f"""
        SELECT
            name, title, project, item_type, urgency, status,
            location, assignee, reported_by, reported_date,
            due_date, completed_date, cost_estimate
        FROM `tabPunch List Item`
        WHERE {where_clause}
        ORDER BY
            CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
            due_date ASC,
            FIELD(urgency, 'Критично', 'Высокая', 'Средняя', 'Низкая') ASC
        LIMIT 500
        """,
        params,
        as_dict=True,
    )
    return rows


@frappe.whitelist()
def get_detail(name: str) -> dict:
    """Детальная карточка."""
    frappe.has_permission("Punch List Item", "read", throw=True)
    doc = frappe.get_doc("Punch List Item", name)
    return doc.as_dict()


# ── Stats ────────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_stats(project: str | None = None) -> dict:
    """KPI: total / open / in_progress / done / overdue / critical."""
    frappe.has_permission("Punch List Item", throw=True)
    today_str = today()

    project_clause = "WHERE 1=1"
    params: dict = {}
    if project:
        project_clause += " AND project = %(project)s"
        params["project"] = project

    row = frappe.db.sql(
        f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'Открыто' THEN 1 ELSE 0 END) AS open,
            SUM(CASE WHEN status = 'В работе' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'Выполнено' THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN status IN ('Открыто', 'В работе')
                      AND due_date IS NOT NULL
                      AND due_date < %(today)s THEN 1 ELSE 0 END) AS overdue,
            SUM(CASE WHEN urgency = 'Критично'
                      AND status != 'Выполнено'
                      AND status != 'Принято заказчиком'
                      AND status != 'Отменено' THEN 1 ELSE 0 END) AS critical
        FROM `tabPunch List Item`
        {project_clause}
        """,
        {**params, "today": today_str},
        as_dict=True,
    )[0]

    return {
        "total": int(row.get("total") or 0),
        "open": int(row.get("open") or 0),
        "in_progress": int(row.get("in_progress") or 0),
        "done": int(row.get("done") or 0),
        "overdue": int(row.get("overdue") or 0),
        "critical": int(row.get("critical") or 0),
    }


# ── Save / status ────────────────────────────────────────────────────────────

@frappe.whitelist()
def save_item(data: dict | str) -> dict:
    """Создать / обновить Punch List Item."""
    frappe.has_permission("Punch List Item", "create", throw=True)

    if isinstance(data, str):
        data = json.loads(data)

    name = data.get("name")
    if name and frappe.db.exists("Punch List Item", name):
        frappe.has_permission("Punch List Item", "write", doc=name, throw=True)
        doc = frappe.get_doc("Punch List Item", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"name": doc.name, "updated": True}

    # Гарантируем reported_date если не пришла
    data.setdefault("reported_date", today())

    doc = frappe.get_doc({"doctype": "Punch List Item", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "created": True}


@frappe.whitelist()
def set_status(name: str, status: str) -> dict:
    """Смена статуса.

    completed_date проставляется автоматически в before_save модели,
    но мы вызываем save (не db.set_value) чтобы хук точно сработал.
    """
    frappe.has_permission("Punch List Item", "write", doc=name, throw=True)
    doc = frappe.get_doc("Punch List Item", name)
    doc.status = status
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {
        "ok": True,
        "name": name,
        "status": doc.status,
        "completed_date": doc.completed_date,
    }


# ── Overdue (для отчётов и cron) ────────────────────────────────────────────

@frappe.whitelist()
def get_overdue(project: str | None = None) -> list[dict]:
    """Только просроченные active-доделки.

    Используется и в отчётах, и в `tasks.check_punch_list_overdue`.
    """
    frappe.has_permission("Punch List Item", throw=True)
    today_str = today()

    filters: dict = {
        "status": ["in", list(ACTIVE_STATUSES)],
        "due_date": ["<", today_str],
    }
    if project:
        filters["project"] = project

    items = frappe.get_all(
        "Punch List Item",
        filters=filters,
        fields=[
            "name", "title", "project", "urgency", "status",
            "assignee", "due_date", "location",
        ],
        order_by="due_date asc",
        limit_page_length=500,
    )

    today_d = getdate(today_str)
    for it in items:
        d = it.get("due_date")
        it["days_overdue"] = (today_d - getdate(d)).days if d else 0

    return items
