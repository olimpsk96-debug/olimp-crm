"""Глобальный поиск по всему ERP — тендеры, проекты, КС-2/3, инциденты, клиенты и т.д.

Работает через SQL LIKE по основным текстовым полям (быстро на ~10K записей).
Для веса используется простой scoring: точное совпадение → 100, начало слова → 80, in-string → 50.
"""
from __future__ import annotations

import frappe
from frappe import _

# DocType-ы для глобального поиска: (label, icon, href_prefix, поля где искать, title-field)
_SEARCH_TARGETS = [
    {"dt": "Tender",               "label": "Тендер",      "icon": "📋", "href": "/tenders",       "search_fields": ["title", "name", "customer"], "title": "title", "extra": ["status", "nmck"]},
    {"dt": "Construction Project", "label": "Проект",      "icon": "🏗", "href": "/projects",      "search_fields": ["title", "name", "customer", "location"], "title": "title", "extra": ["status", "contract_amount"]},
    {"dt": "Estimate",             "label": "Смета",       "icon": "💰", "href": "/estimates",     "search_fields": ["title", "name"], "title": "title", "extra": ["status", "our_total"]},
    {"dt": "KS2 Act",              "label": "КС-2",        "icon": "📑", "href": "/ks2",           "search_fields": ["title", "name", "customer", "contract_number"], "title": "title", "extra": ["status", "amount"]},
    {"dt": "KS3 Act",              "label": "КС-3",        "icon": "📊", "href": "/ks3",           "search_fields": ["title", "name", "customer", "contract_number"], "title": "title", "extra": ["status", "total_period"]},
    {"dt": "Material Request",     "label": "Заявка",      "icon": "📦", "href": "/supply",        "search_fields": ["title", "name"], "title": "title", "extra": ["status", "total_estimated"]},
    {"dt": "Change Order",         "label": "Изменение",   "icon": "🔄", "href": "/change-orders", "search_fields": ["title", "name"], "title": "title", "extra": ["status", "contractor_amount"]},
    {"dt": "Foreman Report",       "label": "Отчёт прораба", "icon": "👷", "href": "/safety",      "search_fields": ["title", "name"], "title": "title", "extra": ["status"]},
    {"dt": "Safety Incident",      "label": "Инцидент",    "icon": "⚠️", "href": "/safety",        "search_fields": ["description", "name", "affected_person"], "title": "description", "extra": ["status", "severity"]},
    {"dt": "Equipment",            "label": "Техника",     "icon": "🛠", "href": "/equipment",     "search_fields": ["equipment_name", "name", "inventory_code", "vin_number"], "title": "equipment_name", "extra": ["status"]},
    {"dt": "Customer",             "label": "Клиент",      "icon": "🏢", "href": "/clients",       "search_fields": ["customer_name", "name"], "title": "customer_name", "extra": []},
    {"dt": "Deal",                 "label": "Сделка",      "icon": "🤝", "href": "/deals",         "search_fields": ["title", "name", "customer"], "title": "title", "extra": ["status", "amount"]},
    {"dt": "Meeting",              "label": "Планёрка",    "icon": "👥", "href": "/meetings",      "search_fields": ["title", "name"], "title": "title", "extra": ["status", "meeting_date"]},
    {"dt": "Cost Catalog Item",    "label": "Расценка",    "icon": "📐", "href": "/catalog",       "search_fields": ["item_name", "name", "code"], "title": "item_name", "extra": ["unit", "base_price"]},
    {"dt": "Catalog Resource",     "label": "Ресурс",      "icon": "🧱", "href": "/resources",     "search_fields": ["resource_name", "name", "resource_code"], "title": "resource_name", "extra": ["unit", "price_avg"]},
    {"dt": "Catalog Work Item",    "label": "Расценка CWICR", "icon": "📕", "href": "/catalog-work-items", "search_fields": ["rate_name", "name", "rate_code"], "title": "rate_name", "extra": ["rate_unit", "category_type"]},
    {"dt": "Work Template",        "label": "Шаблон работ", "icon": "🪄", "href": "/work-templates", "search_fields": ["title", "name", "keywords"], "title": "title", "extra": ["category", "base_unit"]},
]


def _score(text: str, query: str) -> int:
    """Простой scoring: точное совпадение / начало / содержит."""
    if not text:
        return 0
    text_l = text.lower()
    query_l = query.lower()
    if text_l == query_l:
        return 100
    if text_l.startswith(query_l):
        return 80
    if f" {query_l}" in f" {text_l}":  # начало слова
        return 70
    if query_l in text_l:
        return 50
    return 0


@frappe.whitelist()
def search_all(query: str, limit_per_type: int = 5, total_limit: int = 30) -> list[dict]:
    """Глобальный поиск по всем DocType.

    Возвращает плоский список результатов с полями:
    doctype, name, title, label, icon, href, status, extra, score.
    Отсортирован по score убыванию.
    """
    if not query or len(query.strip()) < 2:
        return []

    query = query.strip()
    results: list[dict] = []

    for target in _SEARCH_TARGETS:
        dt = target["dt"]
        if not frappe.db.exists("DocType", dt):
            continue

        # Проверка permission
        try:
            if not frappe.has_permission(dt, "read"):
                continue
        except Exception:
            continue

        # OR-условие по нескольким полям
        or_filters = {fld: ["like", f"%{query}%"] for fld in target["search_fields"]}
        fields = list(set([target["title"], "name"] + target["extra"] + target["search_fields"]))

        try:
            docs = frappe.get_all(
                dt,
                or_filters=or_filters,
                fields=fields,
                limit=int(limit_per_type) * 3,  # берём больше, потом отсеем по score
            )
        except Exception:
            continue

        for d in docs:
            title = d.get(target["title"]) or d["name"]
            # Считаем максимальный score среди полей поиска
            score = max(
                _score(str(d.get(f) or ""), query) for f in target["search_fields"]
            )
            if score == 0:
                continue

            results.append({
                "doctype": dt,
                "name": d["name"],
                "title": str(title)[:120],
                "label": target["label"],
                "icon": target["icon"],
                "href": target["href"],
                "extra": {k: d.get(k) for k in target["extra"]},
                "score": score,
            })

    # Сортировка по score, потом ограничение
    results.sort(key=lambda x: -x["score"])
    return results[:int(total_limit)]
