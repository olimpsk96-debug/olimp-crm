"""ЭКСПЕРИМЕНТАЛЬНО: автоматическая привязка этапов Work Template к Catalog Resource.

⚠️ ВАЖНО: CWICR-каталог содержит ресурсы (материалы/труд/оборудование), а этапы
шаблонов — это работы. Автоматический fuzzy-match между ними даёт много ложных
совпадений (например, «Транспортировка» матчится на «Лебёдки»). Рекомендуется
ручная привязка через админку или через autolink_single_stage с UI-подтверждением.

Endpoints:
- autolink_all_templates(min_score=88, dry_run=0) — массово, осторожно
- autolink_single_stage(stage_id) — одной строкой, для UI-выбора из топ-10
- clear_all_links() — сбросить все автоматические привязки
"""
from __future__ import annotations

import frappe
from frappe.utils import flt

try:
    from rapidfuzz import fuzz, process
except ImportError:
    fuzz = process = None


# Маппинги «название этапа → конкретные термины для поиска в CWICR».
# Только явные привязки — иначе fuzzy дает ложные матчи (стройка → лебёдка).
SEARCH_HINTS = {
    "пескоструйная очистка": ["очистка пескоструйная"],
    "пескоструй": ["очистка пескоструйная"],
    "обеспыливание": ["обеспыливание"],
    "обезжиривание": ["обезжиривание"],
    "грунтование": ["грунт"],
    "грунт ": ["грунт"],
    "грунтовка": ["грунт"],
    "эмаль": ["эмаль"],
    "огнезащитной краски": ["огнезащитное покрытие"],
    "огнезащиты": ["огнезащитное покрытие"],
    "сварка монтажных стыков": ["сварка ручная электродуговая"],
    "сварочные работы": ["сварка ручная электродуговая"],
    "сварка корня шва": ["сварка ручная электродуговая"],
    "монтаж металлоконструкций": ["монтаж металлоконструкций"],
    "пвх-мембран": ["мембрана пвх"],
    "наплавляемой": ["наплавляемая"],
    "армирование": ["арматура"],
    "арматура": ["арматура"],
    "бетонирование": ["бетон"],
    "опалубка": ["опалубка"],
    "леса": ["леса строительные"],
    "укладка плитки": ["плитка керамогранитная"],
    "керамогранита": ["плитка керамогранитная"],
    "штукатурка": ["штукатурка"],
    "минвата": ["плита минераловатная"],
    "минераловатные": ["плита минераловатная"],
    "гипсокартон": ["лист гипсокартонный"],
    "гкл": ["лист гипсокартонный"],
    "кирпич": ["кирпич"],
    "газобетон": ["блок газобетонный"],
    "анкеров": ["анкер химический"],
    "кабел": ["кабель ввгнг"],
    "розетк": ["розетка"],
}

# Этапы которые не нужно линковать (служебные / низкая цена / специфичные)
SKIP_KEYWORDS = (
    "контроль", "приёмка", "приемка", "разметка", "выверка",
    "уборка", "погрузка", "вывоз", "транспортировка", "доставка",
    "пропитка", "уход за бетоном", "опрессовка", "испытание",
    "финишн",  # финишный слой часто матчится на специфические декор-составы
    "промежуточн", "уход",
    "контр-обрешётка", "обрешётка",
    "демонтаж лесов", "демонтаж опалубки",
)


def _search_terms(stage_title: str) -> list[str]:
    """Возвращает список ключевых фраз для поиска CWICR по этапу.

    Если этап в SKIP_KEYWORDS или нет конкретного хинта — пустой список.
    """
    lower = (stage_title or "").lower()
    # Skip служебные этапы
    for skip in SKIP_KEYWORDS:
        if skip in lower:
            return []
    # Только явные хинты — без fallback на «первые слова»
    for key, terms in SEARCH_HINTS.items():
        if key in lower:
            return terms or []
    return []


@frappe.whitelist()
def clear_all_links() -> dict:
    """Сбрасывает все привязки stages.catalog_resource → NULL.
    Используется перед перезапуском autolink с новыми правилами."""
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager", frappe.PermissionError)
    affected = frappe.db.sql(
        """UPDATE `tabWork Stage Template` SET catalog_resource = NULL
           WHERE catalog_resource IS NOT NULL"""
    )
    frappe.db.commit()
    return {"ok": True, "cleared": "all stage links"}


@frappe.whitelist()
def autolink_all_templates(min_score: int = 88, dry_run: int | bool = 0) -> dict:
    """Привязывает все этапы всех шаблонов к CWICR через fuzzy-match.

    Параметры:
    - min_score: минимальный similarity-порог (72 = неплохо, 85 = строго)
    - dry_run=1: только показать что будет привязано, без сохранения
    """
    if not fuzz:
        frappe.throw("rapidfuzz не установлен. Запусти: pip install rapidfuzz")

    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager", frappe.PermissionError)

    # Загружаем все Catalog Resource — это словарь для поиска
    all_resources = frappe.db.sql(
        """SELECT name, resource_name, unit, price_avg, resource_type
           FROM `tabCatalog Resource`
           WHERE resource_name IS NOT NULL AND resource_name != ''""",
        as_dict=True,
    )
    resource_index = {r["resource_name"].lower(): r for r in all_resources}
    resource_names = list(resource_index.keys())
    if not resource_names:
        return {"ok": False, "error": "В Catalog Resource ничего нет"}

    # Собираем все этапы без привязки
    stages = frappe.db.sql(
        """SELECT name, parent, title, unit
           FROM `tabWork Stage Template`
           WHERE (catalog_resource IS NULL OR catalog_resource = '')""",
        as_dict=True,
    )

    linked = 0
    skipped = 0
    suggestions: list[dict] = []

    for stage in stages:
        terms = _search_terms(stage["title"])
        if not terms:
            skipped += 1
            continue

        best_match = None
        best_score = 0
        best_resource = None

        for term in terms:
            matches = process.extract(term, resource_names, scorer=fuzz.WRatio, limit=3)
            for matched_name, score, _ in matches:
                if score > best_score and score >= min_score:
                    best_match = matched_name
                    best_score = score
                    best_resource = resource_index[matched_name]

        if best_resource:
            suggestion = {
                "stage_id": stage["name"],
                "parent": stage["parent"],
                "stage_title": stage["title"],
                "matched_resource": best_resource["name"],
                "matched_name": best_resource["resource_name"],
                "price_avg": flt(best_resource.get("price_avg") or 0),
                "score": best_score,
            }
            suggestions.append(suggestion)

            if not int(dry_run or 0):
                frappe.db.set_value(
                    "Work Stage Template", stage["name"],
                    "catalog_resource", best_resource["name"],
                    update_modified=False,
                )
                linked += 1
        else:
            skipped += 1

    if not int(dry_run or 0):
        frappe.db.commit()

    return {
        "ok": True,
        "total_stages": len(stages),
        "linked": linked,
        "skipped": skipped,
        "dry_run": bool(int(dry_run or 0)),
        "suggestions_sample": suggestions[:20],
    }


@frappe.whitelist()
def autolink_single_stage(stage_id: str, min_score: int = 60) -> dict:
    """Найти все возможные привязки для конкретного этапа (для UI-предложений)."""
    if not fuzz:
        frappe.throw("rapidfuzz не установлен")
    stage = frappe.get_value(
        "Work Stage Template", stage_id,
        ["name", "title", "unit"], as_dict=True,
    )
    if not stage:
        frappe.throw(f"Этап {stage_id} не найден")

    terms = _search_terms(stage["title"])
    if not terms:
        return {"stage": stage_id, "suggestions": []}

    rows = frappe.db.sql(
        """SELECT name, resource_name, unit, price_avg, resource_type
           FROM `tabCatalog Resource`
           WHERE resource_name IS NOT NULL""",
        as_dict=True,
    )
    names = [r["resource_name"] for r in rows]

    suggestions = []
    seen = set()
    for term in terms:
        matches = process.extract(term, names, scorer=fuzz.WRatio, limit=5)
        for matched_name, score, idx in matches:
            if matched_name in seen or score < min_score:
                continue
            seen.add(matched_name)
            r = rows[idx]
            suggestions.append({
                "resource_id": r["name"],
                "resource_name": r["resource_name"],
                "unit": r["unit"],
                "price_avg": flt(r.get("price_avg") or 0),
                "type": r["resource_type"],
                "score": score,
            })

    suggestions.sort(key=lambda x: -x["score"])
    return {"stage": stage_id, "suggestions": suggestions[:10]}
