"""API планёрок — список, детали, создание/обновление, смена статуса.

Поддерживает фильтр по проекту и периоду. Также экспортирует «открытые поручения»
со всех планёрок (для дашборда) — это закрывает разрыв между совещанием и реальным
выполнением: вопрос «кто что обещал на планёрке».
"""
from __future__ import annotations

from datetime import timedelta

import frappe
from frappe import _
from frappe.utils import getdate, nowdate

VALID_STATUSES = ("Запланирована", "Проведена", "Отменена")
VALID_ITEM_STATUSES = ("Открыто", "В работе", "Выполнено", "Отменено")


@frappe.whitelist()
def get_list(project: str | None = None, status: str | None = None, days: int = 60) -> list[dict]:
    """Список планёрок (по умолчанию за последние 60 дней)."""
    frappe.has_permission("Meeting", throw=True)

    cutoff = getdate(nowdate()) - timedelta(days=int(days))
    filters: dict = {"meeting_date": [">=", str(cutoff)]}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status

    return frappe.get_all(
        "Meeting",
        filters=filters,
        fields=[
            "name", "title", "status", "meeting_type", "project",
            "meeting_date", "start_time", "duration_min", "location",
        ],
        order_by="meeting_date desc, start_time desc",
        limit=200,
    )


@frappe.whitelist()
def get_detail(name: str) -> dict:
    """Планёрка с участниками и повесткой."""
    frappe.has_permission("Meeting", "read", throw=True)
    doc = frappe.get_doc("Meeting", name)
    return doc.as_dict()


@frappe.whitelist()
def save_meeting(data: dict) -> dict:
    """Создать или обновить планёрку (upsert по name)."""
    frappe.has_permission("Meeting", "create", throw=True)

    name = data.get("name")
    if name and frappe.db.exists("Meeting", name):
        doc = frappe.get_doc("Meeting", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"updated": doc.name}

    doc = frappe.get_doc({"doctype": "Meeting", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"created": doc.name}


@frappe.whitelist()
def set_status(name: str, status: str) -> dict:
    """Сменить статус планёрки."""
    frappe.has_permission("Meeting", "write", throw=True)
    if status not in VALID_STATUSES:
        frappe.throw(_(f"Недопустимый статус: {status}"))
    frappe.db.set_value("Meeting", name, "status", status, update_modified=False)
    frappe.db.commit()
    return {"ok": True, "name": name, "status": status}


@frappe.whitelist()
def set_item_status(meeting: str, item_idx: int, status: str) -> dict:
    """Сменить статус конкретного поручения внутри планёрки.

    item_idx — индекс позиции в child table (1-based, как у Frappe).
    """
    frappe.has_permission("Meeting", "write", throw=True)
    if status not in VALID_ITEM_STATUSES:
        frappe.throw(_(f"Недопустимый статус поручения: {status}"))

    doc = frappe.get_doc("Meeting", meeting)
    found = False
    for it in doc.items or []:
        if it.idx == int(item_idx):
            it.status = status
            found = True
            break
    if not found:
        frappe.throw(_(f"Поручение #{item_idx} не найдено"))
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "meeting": meeting, "item_idx": item_idx, "status": status}


@frappe.whitelist()
def get_open_items(days: int = 60, limit: int = 50) -> list[dict]:
    """Список **открытых поручений** со всех планёрок за период.

    Используется для дашборда: «кто что должен сделать» по итогам планёрок.
    Сортировка: сначала просроченные, потом по due_date asc.
    """
    frappe.has_permission("Meeting", throw=True)

    cutoff = getdate(nowdate()) - timedelta(days=int(days))
    today = getdate(nowdate())

    rows = frappe.db.sql(
        """SELECT
              m.name AS meeting,
              m.title AS meeting_title,
              m.meeting_date,
              m.project,
              mi.idx AS item_idx,
              mi.topic, mi.decision, mi.responsible, mi.due_date, mi.status
           FROM `tabMeeting Item` mi
           JOIN `tabMeeting` m ON m.name = mi.parent
           WHERE mi.status IN ('Открыто', 'В работе')
             AND m.meeting_date >= %s
           ORDER BY
             CASE WHEN mi.due_date < %s THEN 0 ELSE 1 END,
             mi.due_date ASC,
             m.meeting_date DESC
           LIMIT %s""",
        (str(cutoff), str(today), int(limit)),
        as_dict=True,
    )

    # Помечаем просроченные
    for r in rows:
        if r.get("due_date"):
            days_to = (getdate(r["due_date"]) - today).days
            r["overdue"] = days_to < 0
            r["days_to_due"] = days_to
        else:
            r["overdue"] = False
            r["days_to_due"] = None
    return rows


@frappe.whitelist()
def get_stats(days: int = 30) -> dict:
    """Сводка: сколько планёрок, сколько открытых/выполненных поручений."""
    frappe.has_permission("Meeting", throw=True)

    cutoff = getdate(nowdate()) - timedelta(days=int(days))

    total_meetings = frappe.db.count("Meeting", {"meeting_date": [">=", str(cutoff)]})
    held = frappe.db.count("Meeting", {"meeting_date": [">=", str(cutoff)], "status": "Проведена"})

    items_by_status = frappe.db.sql(
        """SELECT mi.status, COUNT(*) as cnt
           FROM `tabMeeting Item` mi
           JOIN `tabMeeting` m ON m.name = mi.parent
           WHERE m.meeting_date >= %s
           GROUP BY mi.status""",
        (str(cutoff),),
        as_dict=True,
    )

    today = getdate(nowdate())
    overdue = frappe.db.sql(
        """SELECT COUNT(*) FROM `tabMeeting Item` mi
           JOIN `tabMeeting` m ON m.name = mi.parent
           WHERE mi.status IN ('Открыто', 'В работе')
             AND mi.due_date IS NOT NULL
             AND mi.due_date < %s""",
        (str(today),),
    )[0][0]

    return {
        "days": int(days),
        "total_meetings": total_meetings,
        "held": held,
        "items_by_status": {row["status"]: row["cnt"] for row in items_by_status},
        "overdue_items": int(overdue or 0),
    }
