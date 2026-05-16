"""API для поиска похожих сущностей (Linear "Similar Issues").

При создании риска / доделки / задачи показываем 3 похожих существующих —
«это, возможно, дубль». Используем rapidfuzz token_sort_ratio (без OpenAI/Qdrant),
поиск по полю title с опциональным учётом description.

Поддерживаемые DocTypes:
- Project Risk           — поиск по title + notes
- Punch List Item        — поиск по title + description
- Schedule Task          — поиск по title + notes
- Construction Project Update — поиск по summary
"""
from __future__ import annotations

import frappe
from frappe.utils import add_days, nowdate


# DocType → (поля поиска, поля возврата, фильтр сужения)
SUPPORTED = {
    "Project Risk": {
        "search_fields": ["title", "notes"],
        "return_fields": ["name", "title", "category", "status", "risk_score", "project"],
        "active_filter": {"status": ["not in", ["Закрыт", "Снят"]]},
    },
    "Punch List Item": {
        "search_fields": ["title", "description"],
        "return_fields": ["name", "title", "item_type", "urgency", "status", "project", "due_date"],
        "active_filter": {"status": ["not in", ["Закрыт", "Отменён"]]},
    },
    "Schedule Task": {
        "search_fields": ["title", "notes"],
        "return_fields": ["name", "title", "status", "project", "start_date", "end_date"],
        "active_filter": {"status": ["not in", ["Завершена", "Отменена"]]},
    },
    "Construction Project Update": {
        "search_fields": ["summary", "blockers"],
        "return_fields": ["name", "project", "week_start", "health", "summary"],
        "active_filter": {},
    },
}


@frappe.whitelist()
def find_similar(doctype: str, text: str, project: str | None = None,
                 threshold: int = 70, limit: int = 5, days: int = 365) -> list[dict]:
    """Возвращает топ-N похожих документов с score (0-100).

    threshold — минимальный rapidfuzz score (0-100), ниже отсекаем.
    project — если указан, ищем только в этом проекте.
    days — глубина окна для производительности.
    """
    if doctype not in SUPPORTED:
        frappe.throw(f"DocType {doctype} не поддерживается. Доступны: {list(SUPPORTED.keys())}")
    if not text or len(text.strip()) < 3:
        return []

    try:
        from rapidfuzz import fuzz
    except ImportError:
        frappe.logger().warning("rapidfuzz не установлен — find_similar возвращает []")
        return []

    frappe.has_permission(doctype, throw=True)

    cfg = SUPPORTED[doctype]
    filters: dict = dict(cfg["active_filter"])
    filters["creation"] = [">=", add_days(nowdate(), -int(days))]
    if project:
        filters["project"] = project

    # Берём кандидатов с фильтром и считаем similarity локально (не SQL)
    fields = list(set(["name"] + cfg["search_fields"] + cfg["return_fields"]))
    candidates = frappe.get_all(
        doctype, filters=filters, fields=fields,
        order_by="modified DESC", limit_page_length=500,
    )

    query_text = text.lower().strip()
    scored: list[tuple[int, dict]] = []
    for c in candidates:
        # Собираем общий текст для сравнения (title + description/notes)
        haystack_parts = []
        for f in cfg["search_fields"]:
            v = c.get(f)
            if v:
                haystack_parts.append(str(v))
        if not haystack_parts:
            continue
        haystack = " ".join(haystack_parts).lower()

        # Двойной score: на title (вес 70%) + на полный текст (вес 30%)
        title_score = fuzz.token_sort_ratio(query_text, str(c.get(cfg["search_fields"][0]) or "").lower())
        full_score = fuzz.partial_ratio(query_text, haystack)
        score = int(round(0.7 * title_score + 0.3 * full_score))

        if score >= int(threshold):
            scored.append((score, c))

    scored.sort(key=lambda x: -x[0])
    out: list[dict] = []
    for score, c in scored[: int(limit)]:
        result = {k: c.get(k) for k in cfg["return_fields"]}
        result["score"] = score
        # Подтянем проект-тайтл
        if "project" in result and result["project"]:
            result["project_title"] = frappe.db.get_value("Construction Project", result["project"], "title") or result["project"]
        out.append(result)
    return out


@frappe.whitelist()
def find_similar_global(text: str, project: str | None = None,
                        threshold: int = 70, limit_per_type: int = 3) -> dict:
    """Параллельный поиск по всем поддерживаемым DocTypes — для глобальных
    диалогов «возможный дубль?» при создании новой сущности."""
    out: dict = {}
    for dt in SUPPORTED:
        try:
            out[dt] = find_similar(
                doctype=dt, text=text, project=project,
                threshold=threshold, limit=limit_per_type, days=365,
            )
        except frappe.PermissionError:
            out[dt] = []
    return out
