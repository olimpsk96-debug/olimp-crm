"""API для Capacity Planning по бригадам (Asana-style).

Идея: квартальное планирование загрузки бригад по проектам в % или
человеко-часах. Heatmap-вид: где перегруз (>100%), где простой (<50%).
"""
from __future__ import annotations

from datetime import timedelta

import frappe
from frappe.utils import add_days, getdate, nowdate


def _monday_of(date_str: str | None = None) -> str:
    d = getdate(date_str) if date_str else getdate(nowdate())
    monday = d - timedelta(days=d.weekday())
    return monday.strftime("%Y-%m-%d")


@frappe.whitelist()
def list_allocations(crew_name: str | None = None, project: str | None = None,
                     from_week: str | None = None, weeks: int = 8) -> list[dict]:
    frappe.has_permission("Crew Allocation", throw=True)

    start = _monday_of(from_week) if from_week else _monday_of()
    end_d = getdate(start) + timedelta(weeks=int(weeks))

    filters: dict = {
        "week_start": ["between", [start, end_d.strftime("%Y-%m-%d")]],
    }
    if crew_name:
        filters["crew_name"] = crew_name
    if project:
        filters["project"] = project

    rows = frappe.get_all(
        "Crew Allocation",
        filters=filters,
        fields=["name", "crew_name", "project", "week_start",
                "allocated_pct", "planned_hours", "workers_count",
                "task_description"],
        order_by="week_start ASC, crew_name ASC",
        limit_page_length=500,
    )
    for r in rows:
        r["project_title"] = frappe.db.get_value("Construction Project", r["project"], "title") or r["project"]
    return rows


@frappe.whitelist()
def save_allocation(name: str | None = None, crew_name: str = "",
                    project: str = "", week_start: str | None = None,
                    allocated_pct: float = 100, planned_hours: float = 0,
                    workers_count: int = 0,
                    task_description: str = "") -> dict:
    if not crew_name.strip():
        frappe.throw("crew_name обязателен")
    if not project:
        frappe.throw("project обязателен")
    week = _monday_of(week_start)

    existing = name or frappe.db.get_value(
        "Crew Allocation",
        {"crew_name": crew_name.strip(), "project": project, "week_start": week},
        "name",
    )

    if existing:
        frappe.has_permission("Crew Allocation", "write", doc=existing, throw=True)
        doc = frappe.get_doc("Crew Allocation", existing)
        action = "updated"
    else:
        frappe.has_permission("Crew Allocation", "create", throw=True)
        doc = frappe.new_doc("Crew Allocation")
        action = "created"

    doc.crew_name = crew_name.strip()[:140]
    doc.project = project
    doc.week_start = week
    doc.allocated_pct = float(allocated_pct or 0)
    doc.planned_hours = float(planned_hours or 0)
    doc.workers_count = int(workers_count or 0)
    doc.task_description = (task_description or "").strip()[:500]

    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name, "action": action}


@frappe.whitelist()
def delete_allocation(name: str) -> dict:
    frappe.has_permission("Crew Allocation", "delete", doc=name, throw=True)
    frappe.delete_doc("Crew Allocation", name, ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist()
def get_heatmap(from_week: str | None = None, weeks: int = 8) -> dict:
    """Heatmap-сетка: бригада × неделя → суммарный allocated_pct.

    Возвращает:
    {
      "weeks": ["2026-05-11", "2026-05-18", ...],
      "crews": ["Бригада №1", "Бригада №2", ...],
      "cells": {"Бригада №1::2026-05-11": {"pct": 130, "projects": ["PR-001 (80%)", "PR-002 (50%)"]}},
      "totals_by_week": [{"week": ..., "avg_pct": .., "max_pct": .., "overloaded_crews": [..]}]
    }
    """
    frappe.has_permission("Crew Allocation", throw=True)

    start = _monday_of(from_week) if from_week else _monday_of()
    start_d = getdate(start)

    week_list: list[str] = []
    for i in range(int(weeks)):
        w = (start_d + timedelta(weeks=i)).strftime("%Y-%m-%d")
        week_list.append(w)
    end_str = (start_d + timedelta(weeks=int(weeks))).strftime("%Y-%m-%d")

    rows = frappe.db.sql("""
        SELECT crew_name, project, week_start,
               COALESCE(SUM(allocated_pct), 0) AS pct,
               COALESCE(SUM(planned_hours), 0) AS hours,
               GROUP_CONCAT(CONCAT(project, ' (', ROUND(allocated_pct), %(pct_sign)s)
                            ORDER BY allocated_pct DESC SEPARATOR ', ') AS projects_str
        FROM `tabCrew Allocation`
        WHERE week_start >= %(s)s AND week_start < %(e)s
        GROUP BY crew_name, week_start
        ORDER BY crew_name, week_start
    """, {"s": start, "e": end_str, "pct_sign": "%)"}, as_dict=True)

    crews_set: set = set()
    cells: dict = {}
    for r in rows:
        crews_set.add(r["crew_name"])
        key = f"{r['crew_name']}::{r['week_start']}"
        cells[key] = {
            "pct": float(r["pct"] or 0),
            "hours": float(r["hours"] or 0),
            "projects_str": r["projects_str"] or "",
        }

    crews = sorted(crews_set)

    # Totals по неделям
    totals_by_week = []
    for w in week_list:
        week_pcts = [cells.get(f"{c}::{w}", {}).get("pct", 0) for c in crews]
        non_zero = [p for p in week_pcts if p > 0]
        overloaded = [crews[i] for i, p in enumerate(week_pcts) if p > 100]
        idle = [crews[i] for i, p in enumerate(week_pcts) if 0 < p < 50]
        totals_by_week.append({
            "week": w,
            "avg_pct": sum(non_zero) / len(non_zero) if non_zero else 0,
            "max_pct": max(week_pcts) if week_pcts else 0,
            "overloaded_crews": overloaded,
            "idle_crews": idle,
            "active_count": len(non_zero),
        })

    return {
        "weeks": week_list,
        "crews": crews,
        "cells": cells,
        "totals_by_week": totals_by_week,
        "from_week": start,
    }


@frappe.whitelist()
def get_crews() -> list[str]:
    """Список уникальных имён бригад (для подсказок в форме)."""
    frappe.has_permission("Crew Allocation", throw=True)
    rows = frappe.db.sql("""
        SELECT DISTINCT crew_name FROM `tabCrew Allocation`
        ORDER BY crew_name ASC
    """, pluck="crew_name")
    return list(rows)
