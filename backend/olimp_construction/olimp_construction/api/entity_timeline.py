"""Activity Timeline — единая лента событий по конкретной сущности.

Собирает из:
- tabVersion (audit log) — изменения полей
- tabComment — комментарии и логи (например, «⚽ Передан мяч»)
- tabCommunication — письма/звонки/чат
- Linked records — изменения связанных документов

Используется в drawer'ах /deals, /tenders, /projects, /change-orders.
"""
from __future__ import annotations

import json

import frappe
from frappe.utils import flt


@frappe.whitelist()
def get_timeline(doctype: str, name: str, limit: int = 50) -> list[dict]:
    """Возвращает события по конкретной сущности отсортированные по времени.

    Каждое событие: {kind, time, who, summary, details}
    kind: version | comment | communication | linked
    """
    frappe.has_permission(doctype, "read", doc=name, throw=True)
    limit = max(1, min(int(limit), 200))

    events: list[dict] = []

    # 1) Versions (изменения полей)
    versions = frappe.db.sql(
        """SELECT name, owner, creation, data
           FROM `tabVersion`
           WHERE ref_doctype = %(dt)s AND docname = %(n)s
           ORDER BY creation DESC
           LIMIT %(lim)s""",
        {"dt": doctype, "n": name, "lim": limit}, as_dict=True,
    )
    for v in versions:
        try:
            data = json.loads(v.get("data") or "{}")
        except (json.JSONDecodeError, TypeError):
            data = {}
        # Парсим changed-fields из version.data
        changed = (data.get("changed") or [])
        if changed:
            field_changes = []
            for c in changed[:5]:
                if isinstance(c, list) and len(c) >= 3:
                    fld, old, new = c[0], c[1], c[2]
                    old_str = str(old)[:40] if old is not None else "—"
                    new_str = str(new)[:40] if new is not None else "—"
                    field_changes.append(f"{fld}: «{old_str}» → «{new_str}»")
            summary = "; ".join(field_changes) if field_changes else "Документ изменён"
        else:
            summary = "Документ изменён"
        events.append({
            "kind": "version",
            "icon": "✏️",
            "time": v["creation"].isoformat() if v["creation"] else None,
            "who": v.get("owner") or "—",
            "summary": summary[:300],
        })

    # 2) Comments (произвольные комментарии + лог ball-shifts)
    comments = frappe.db.sql(
        """SELECT name, comment_type, owner, creation, content
           FROM `tabComment`
           WHERE reference_doctype = %(dt)s AND reference_name = %(n)s
           ORDER BY creation DESC
           LIMIT %(lim)s""",
        {"dt": doctype, "n": name, "lim": limit}, as_dict=True,
    )
    for c in comments:
        kind_icon = {
            "Comment": "💬", "Info": "ℹ️", "Like": "👍",
            "Workflow": "🔀", "Created": "✨", "Submitted": "✅",
            "Cancelled": "❌", "Updated": "📝", "Deleted": "🗑️",
            "Assignment Completed": "✓", "Assigned": "👤",
        }.get(c.get("comment_type") or "Comment", "💬")
        # Очищаем HTML из content
        import re as _re
        clean = _re.sub(r"<[^>]+>", " ", c.get("content") or "").strip()[:300]
        events.append({
            "kind": "comment",
            "icon": kind_icon,
            "time": c["creation"].isoformat() if c["creation"] else None,
            "who": c.get("owner") or "—",
            "summary": clean,
        })

    # 3) Communications (письма/звонки)
    try:
        comms = frappe.db.sql(
            """SELECT name, communication_type, owner, creation, subject, sender
               FROM `tabCommunication`
               WHERE reference_doctype = %(dt)s AND reference_name = %(n)s
               ORDER BY creation DESC
               LIMIT %(lim)s""",
            {"dt": doctype, "n": name, "lim": limit}, as_dict=True,
        )
        for cm in comms:
            type_icon = {
                "Email": "✉️", "Phone": "📞", "Chat": "💬",
                "Visit": "🚶", "Other": "📎",
            }.get(cm.get("communication_type") or "Other", "📎")
            events.append({
                "kind": "communication",
                "icon": type_icon,
                "time": cm["creation"].isoformat() if cm["creation"] else None,
                "who": cm.get("sender") or cm.get("owner") or "—",
                "summary": (cm.get("subject") or cm.get("communication_type") or "—")[:300],
            })
    except Exception:
        pass  # Communication может не существовать в minimal install

    # Сортируем по времени убывания
    events.sort(key=lambda x: x.get("time") or "", reverse=True)
    return events[:limit]


@frappe.whitelist()
def add_comment(doctype: str, name: str, content: str) -> dict:
    """Добавить произвольный комментарий к сущности (попадает в timeline)."""
    frappe.has_permission(doctype, "write", doc=name, throw=True)
    if not content or not content.strip():
        frappe.throw("Пустой комментарий")
    doc = frappe.get_doc({
        "doctype": "Comment",
        "comment_type": "Comment",
        "reference_doctype": doctype,
        "reference_name": name,
        "content": content.strip()[:5000],
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "comment_id": doc.name}
