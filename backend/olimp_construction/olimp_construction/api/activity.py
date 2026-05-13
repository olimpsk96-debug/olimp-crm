"""Activity Feed — лента активности по проекту/всему ERP.

Идея из OpenProject: единая хронология событий компании, чтобы директор за 30 секунд
видел «что произошло». Не дублирует Frappe Activity Log — здесь только бизнес-события
(создание/смена статуса в наших DocType), без технического шума.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import frappe
from frappe import _
from frappe.utils import flt, get_datetime, getdate, now_datetime

# DocType-ы, события которых попадают в ленту, и метаданные для UI
_TRACKED = {
    "Tender": {
        "icon": "📋", "label": "Тендер", "href": "/tenders",
        "title_field": "title",
        "status_field": "status",
    },
    "Estimate": {
        "icon": "💰", "label": "Смета", "href": "/estimates",
        "title_field": "title",
        "status_field": "status",
    },
    "KS2 Act": {
        "icon": "📑", "label": "КС-2", "href": "/ks2",
        "title_field": "title",
        "status_field": "status",
    },
    "KS3 Act": {
        "icon": "📊", "label": "КС-3", "href": "/ks3",
        "title_field": "title",
        "status_field": "status",
    },
    "Material Request": {
        "icon": "📦", "label": "Заявка снабж.", "href": "/supply",
        "title_field": "title",
        "status_field": "status",
    },
    "Change Order": {
        "icon": "🔄", "label": "Изменение", "href": "/change-orders",
        "title_field": "title",
        "status_field": "status",
    },
    "Foreman Report": {
        "icon": "👷", "label": "Отчёт прораба", "href": "/safety",
        "title_field": "title",
        "status_field": "status",
    },
    "Safety Incident": {
        "icon": "⚠️", "label": "Инцидент ОТ/ТБ", "href": "/safety",
        "title_field": "description",
        "status_field": "status",
    },
    "Equipment": {
        "icon": "🛠", "label": "Техника", "href": "/equipment",
        "title_field": "equipment_name",
        "status_field": "status",
    },
    "Interaction": {
        "icon": "💬", "label": "Взаимодействие", "href": "/clients",
        "title_field": "next_action",
        "status_field": None,
    },
    "Deal": {
        "icon": "🤝", "label": "Сделка", "href": "/deals",
        "title_field": "title",
        "status_field": "status",
    },
    "Construction Project": {
        "icon": "🏗", "label": "Проект", "href": "/projects",
        "title_field": "title",
        "status_field": "status",
    },
    "Meeting": {
        "icon": "👥", "label": "Планёрка", "href": "/meetings",
        "title_field": "title",
        "status_field": "status",
    },
}


@frappe.whitelist()
def get_feed(
    project: str | None = None,
    doctype_filter: str | None = None,
    days: int = 14,
    limit: int = 100,
) -> list[dict]:
    """Возвращает события за последние N дней по всем нашим DocType, отсортированные по времени.

    Каждое событие: {doctype, name, title, status, action, when, who, project, icon, label, href}.
    action ∈ {created, updated, status_changed}.
    """
    days = int(days)
    limit = int(limit)
    cutoff = now_datetime() - timedelta(days=days)
    cutoff_str = cutoff.strftime("%Y-%m-%d %H:%M:%S")

    events: list[dict] = []
    doctypes = [doctype_filter] if doctype_filter and doctype_filter in _TRACKED else list(_TRACKED.keys())

    for dt in doctypes:
        if not frappe.db.exists("DocType", dt):
            continue

        meta = _TRACKED[dt]
        title_field = meta["title_field"]
        status_field = meta["status_field"]

        fields = ["name", "creation", "modified", "owner", "modified_by"]
        # Проверяем существование полей (некоторые DocType могут не иметь нужных)
        try:
            doc_meta = frappe.get_meta(dt)
            available_fields = {f.fieldname for f in doc_meta.fields}
        except Exception:
            continue

        if title_field in available_fields:
            fields.append(title_field)
        if status_field and status_field in available_fields:
            fields.append(status_field)
        if "project" in available_fields:
            fields.append("project")

        filters = {"modified": [">=", cutoff_str]}
        if project and "project" in available_fields:
            filters["project"] = project

        try:
            docs = frappe.get_all(dt, filters=filters, fields=fields, order_by="modified desc", limit=limit)
        except Exception:
            continue

        for d in docs:
            title = d.get(title_field) or d["name"]
            # Срезаем длинные тексты
            if isinstance(title, str) and len(title) > 100:
                title = title[:97] + "…"

            creation = get_datetime(d["creation"])
            modified = get_datetime(d["modified"])
            is_new = (modified - creation).total_seconds() < 5  # создан 5 сек назад → action=created
            action = "created" if is_new else "updated"

            who = d.get("modified_by") or d.get("owner") or "system"
            who_short = who.split("@")[0] if "@" in who else who

            events.append({
                "doctype": dt,
                "name": d["name"],
                "title": title,
                "status": d.get(status_field) if status_field else None,
                "action": action,
                "when": modified.isoformat(),
                "when_ts": modified.timestamp(),
                "who": who_short,
                "project": d.get("project"),
                "icon": meta["icon"],
                "label": meta["label"],
                "href": meta["href"],
            })

    # Сортировка по времени убывающая
    events.sort(key=lambda e: e["when_ts"], reverse=True)
    return events[:limit]


@frappe.whitelist()
def get_summary(days: int = 7) -> dict:
    """Сводка за период: что и сколько происходило по типам.

    Используется для блока «За неделю» на дашборде.
    """
    days = int(days)
    cutoff = (now_datetime() - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")

    summary: dict[str, int] = {}
    total = 0

    for dt, meta in _TRACKED.items():
        if not frappe.db.exists("DocType", dt):
            continue
        try:
            count = frappe.db.count(dt, {"modified": [">=", cutoff]})
        except Exception:
            count = 0
        if count > 0:
            summary[meta["label"]] = count
            total += count

    # Топ-3 наиболее активных типа
    top = sorted(summary.items(), key=lambda x: x[1], reverse=True)[:3]

    return {
        "total_events": total,
        "days": days,
        "by_type": summary,
        "top": [{"label": k, "count": v} for k, v in top],
    }
