"""API для модуля графиков работ (Schedule Task — Gantt).

Эндпоинты:
- get_tasks(project) — список задач проекта, с расчётом сводок для разделов
- save_task(data) — создание/обновление задачи (или раздела)
- delete_task(name) — удаление (с проверкой что нет детей)
- set_progress(name, progress) — быстрая смена прогресса (drag-bar в UI)
- set_dates(name, start_date, end_date) — drag-and-drop изменение сроков
- get_summary(project) — общая статистика: KPI по графику (всего, в работе, выполнено, просрочено)
"""
from __future__ import annotations

import json

import frappe
from frappe.utils import flt, getdate, today


# ── List / detail ────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_tasks(project: str) -> dict:
    """Все задачи проекта + рассчитанные сводки для разделов.

    Возвращает:
      {
        project: <name>,
        tasks: [...плоский список с заполненным `children_ids` и для разделов
                — авто-start/end/duration/progress на основе детей...],
        bounds: {start: <minDate>, end: <maxDate>, total_days: N}
      }
    """
    frappe.has_permission("Schedule Task", throw=True)

    rows = frappe.db.sql(
        """
        SELECT
            name, project, parent_task, is_section, is_critical,
            title, status, start_date, end_date, duration_days, progress,
            assignee, subcontractor, order_idx, predecessor,
            estimate_item_link, notes
        FROM `tabSchedule Task`
        WHERE project = %(p)s
        ORDER BY order_idx ASC, start_date ASC, creation ASC
        """,
        {"p": project},
        as_dict=True,
    )

    # Индекс детей по parent_task
    children_by_parent: dict[str, list[dict]] = {}
    for r in rows:
        pt = r.get("parent_task")
        if pt:
            children_by_parent.setdefault(pt, []).append(r)

    # Заполняем сводки для разделов (is_section=1)
    for r in rows:
        if r.get("is_section"):
            kids = children_by_parent.get(r["name"], [])
            if kids:
                starts = [k.get("start_date") for k in kids if k.get("start_date")]
                ends = [k.get("end_date") for k in kids if k.get("end_date")]
                if starts:
                    r["start_date"] = min(starts)
                if ends:
                    r["end_date"] = max(ends)
                if r.get("start_date") and r.get("end_date"):
                    r["duration_days"] = (getdate(r["end_date"]) - getdate(r["start_date"])).days + 1
                # Прогресс раздела = средний по детям (по факту: продолжительность × прогресс / суммарная продолжительность)
                total_days = sum(flt(k.get("duration_days") or 0) for k in kids)
                if total_days > 0:
                    weighted = sum(flt(k.get("duration_days") or 0) * flt(k.get("progress") or 0) for k in kids)
                    r["progress"] = round(weighted / total_days, 1)
                # Является ли раздел "в работе" — если хоть один ребенок в работе
                statuses = {k.get("status") for k in kids}
                if "В работе" in statuses:
                    r["status"] = "В работе"
                elif statuses == {"Выполнена"}:
                    r["status"] = "Выполнена"

    # Bounds (для timeline)
    all_starts = [r.get("start_date") for r in rows if r.get("start_date") and not r.get("is_section")]
    all_ends = [r.get("end_date") for r in rows if r.get("end_date") and not r.get("is_section")]
    bounds = None
    if all_starts and all_ends:
        s = min(all_starts)
        e = max(all_ends)
        bounds = {
            "start": s,
            "end": e,
            "total_days": (getdate(e) - getdate(s)).days + 1,
        }

    return {
        "project": project,
        "tasks": rows,
        "bounds": bounds,
    }


@frappe.whitelist()
def get_summary(project: str) -> dict:
    """KPI: total / planned / in_progress / done / overdue / critical_count / avg_progress."""
    frappe.has_permission("Schedule Task", throw=True)
    today_str = today()
    row = frappe.db.sql(
        """
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN is_section = 0 AND status = 'Запланирована' THEN 1 ELSE 0 END) AS planned,
            SUM(CASE WHEN is_section = 0 AND status = 'В работе' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN is_section = 0 AND status = 'Выполнена' THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN is_section = 0
                      AND status IN ('Запланирована','В работе')
                      AND end_date IS NOT NULL
                      AND end_date < %(today)s THEN 1 ELSE 0 END) AS overdue,
            SUM(CASE WHEN is_section = 0 AND is_critical = 1 THEN 1 ELSE 0 END) AS critical_count,
            AVG(CASE WHEN is_section = 0 THEN progress END) AS avg_progress
        FROM `tabSchedule Task`
        WHERE project = %(p)s
        """,
        {"p": project, "today": today_str},
        as_dict=True,
    )[0]
    return {
        "total": int(row.get("total") or 0),
        "planned": int(row.get("planned") or 0),
        "in_progress": int(row.get("in_progress") or 0),
        "done": int(row.get("done") or 0),
        "overdue": int(row.get("overdue") or 0),
        "critical_count": int(row.get("critical_count") or 0),
        "avg_progress": round(flt(row.get("avg_progress") or 0), 1),
    }


# ── Create / update / delete ─────────────────────────────────────────────────

@frappe.whitelist()
def save_task(data: dict | str) -> dict:
    """Создать или обновить Schedule Task."""
    if isinstance(data, str):
        data = json.loads(data)

    name = data.get("name")
    if name and frappe.db.exists("Schedule Task", name):
        frappe.has_permission("Schedule Task", "write", doc=name, throw=True)
        doc = frappe.get_doc("Schedule Task", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"name": doc.name, "updated": True}

    frappe.has_permission("Schedule Task", "create", throw=True)
    doc = frappe.get_doc({"doctype": "Schedule Task", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "created": True}


@frappe.whitelist()
def delete_task(name: str) -> dict:
    """Удалить задачу/раздел. Если у раздела есть дети — отвязать их (parent_task=NULL)."""
    frappe.has_permission("Schedule Task", "delete", doc=name, throw=True)

    children = frappe.get_all("Schedule Task", filters={"parent_task": name}, pluck="name")
    for child in children:
        frappe.db.set_value("Schedule Task", child, "parent_task", None)

    frappe.delete_doc("Schedule Task", name, ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "deleted": name, "detached_children": children}


@frappe.whitelist()
def set_progress(name: str, progress: float) -> dict:
    """Быстрая смена прогресса (auto-обновит статус через before_save)."""
    frappe.has_permission("Schedule Task", "write", doc=name, throw=True)
    doc = frappe.get_doc("Schedule Task", name)
    doc.progress = flt(progress)
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "name": name, "progress": doc.progress, "status": doc.status}


@frappe.whitelist()
def set_dates(name: str, start_date: str | None = None, end_date: str | None = None) -> dict:
    """Изменение start/end (для drag-and-drop в Gantt). duration_days пересчитается."""
    frappe.has_permission("Schedule Task", "write", doc=name, throw=True)
    doc = frappe.get_doc("Schedule Task", name)
    if start_date:
        doc.start_date = start_date
    if end_date:
        doc.end_date = end_date
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {
        "ok": True,
        "name": name,
        "start_date": str(doc.start_date) if doc.start_date else None,
        "end_date": str(doc.end_date) if doc.end_date else None,
        "duration_days": doc.duration_days,
    }
