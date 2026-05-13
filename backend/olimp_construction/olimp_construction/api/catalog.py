"""API справочника расценок (Cost Catalog) с инкрементальным fuzzy-поиском.

Использует rapidfuzz для подбора похожих позиций.
+ ETL импорт DDC CWICR (Construction Work Items, Components & Resources)
  из https://github.com/datadrivenconstruction/OpenConstructionEstimate-DDC-CWICR
  Лицензия CC BY 4.0 (требует атрибуции).
"""
from __future__ import annotations

import csv
import os

import frappe
from frappe import _
from frappe.utils import flt


@frappe.whitelist()
def get_list(section: str | None = None, search: str | None = None, limit: int = 100) -> list[dict]:
    """Список позиций каталога с фильтрами и поиском."""
    frappe.has_permission("Cost Catalog Item", throw=True)

    filters: dict = {"is_active": 1}
    if section:
        filters["section"] = section

    or_filters = {}
    if search:
        or_filters = {
            "item_name": ["like", f"%{search}%"],
            "code": ["like", f"%{search}%"],
        }

    return frappe.get_all(
        "Cost Catalog Item",
        filters=filters,
        or_filters=or_filters,
        fields=[
            "name", "item_name", "code", "section", "standard", "edition",
            "unit", "base_price", "work_type", "region", "usage_count", "notes",
        ],
        order_by="usage_count desc, section asc, item_name asc",
        limit=int(limit),
    )


@frappe.whitelist()
def fuzzy_search(query: str, limit: int = 10) -> list[dict]:
    """Нечёткий поиск через rapidfuzz по наименованию + коду.

    Используется для подсказок при ручном вводе позиции сметы и Change Order'а.
    """
    frappe.has_permission("Cost Catalog Item", "read", throw=True)

    if not query or len(query.strip()) < 2:
        return []

    try:
        from rapidfuzz import fuzz, process
    except ImportError:
        # Fallback на простой LIKE-поиск, если rapidfuzz нет
        return get_list(search=query, limit=int(limit))

    all_items = frappe.get_all(
        "Cost Catalog Item",
        filters={"is_active": 1},
        fields=["name", "item_name", "code", "unit", "base_price", "section", "standard"],
        limit=2000,
    )

    if not all_items:
        return []

    # rapidfuzz возвращает [(matched_string, score, index), ...]
    choices = {i: f"{it['item_name']} {it.get('code', '')}" for i, it in enumerate(all_items)}
    matches = process.extract(query, choices, scorer=fuzz.WRatio, limit=int(limit))

    results = []
    for _matched_str, score, idx in matches:
        if score < 50:
            break
        item = dict(all_items[idx])
        item["match_score"] = round(float(score), 1)
        results.append(item)
    return results


@frappe.whitelist()
def save_item(data: dict) -> dict:
    """Создать или обновить позицию каталога."""
    frappe.has_permission("Cost Catalog Item", "create", throw=True)

    name = data.get("name")
    if name and frappe.db.exists("Cost Catalog Item", name):
        doc = frappe.get_doc("Cost Catalog Item", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"updated": doc.name}

    doc = frappe.get_doc({"doctype": "Cost Catalog Item", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"created": doc.name}


@frappe.whitelist()
def use_item(name: str) -> dict:
    """Инкремент счётчика использования (вызывается при добавлении в смету)."""
    frappe.has_permission("Cost Catalog Item", "read", throw=True)
    current = frappe.db.get_value("Cost Catalog Item", name, "usage_count") or 0
    frappe.db.set_value("Cost Catalog Item", name, "usage_count", int(current) + 1, update_modified=False)
    frappe.db.commit()
    return {"ok": True, "usage_count": int(current) + 1}


@frappe.whitelist()
def get_stats() -> dict:
    """Сводка по каталогу: всего активных, по разделам, топ-5 использованных."""
    frappe.has_permission("Cost Catalog Item", throw=True)

    total = frappe.db.count("Cost Catalog Item", {"is_active": 1})

    by_section = frappe.db.sql(
        """SELECT section, COUNT(*) as cnt
           FROM `tabCost Catalog Item`
           WHERE is_active=1 AND section IS NOT NULL AND section != ''
           GROUP BY section ORDER BY cnt DESC""",
        as_dict=True,
    )

    top_used = frappe.get_all(
        "Cost Catalog Item",
        filters={"is_active": 1, "usage_count": [">", 0]},
        fields=["name", "item_name", "unit", "base_price", "usage_count"],
        order_by="usage_count desc",
        limit=5,
    )

    return {
        "total": total,
        "by_section": by_section,
        "top_used": top_used,
    }


# ────────────────────────── Seed (одноразовая загрузка) ─────────────────────


_SEED_DATA = [
    # АКЗ / Антикоррозийная защита (раздел 13)
    {"section": "13 — Защита от коррозии (АКЗ)", "standard": "ГЭСН", "code": "13-03-002-01",
     "item_name": "Очистка металлических поверхностей вручную (степень 2)",
     "unit": "м²", "base_price": 145, "work_type": "АКЗ",
     "notes": "Удаление ржавчины и старого покрытия щётками/скребками. Подготовка под грунтование."},
    {"section": "13 — Защита от коррозии (АКЗ)", "standard": "ГЭСН", "code": "13-03-002-04",
     "item_name": "Пескоструйная очистка металлоконструкций",
     "unit": "м²", "base_price": 410, "work_type": "АКЗ",
     "notes": "Очистка до степени Sa 2,5 (близкая к белой стали). Включает компрессор, абразив."},
    {"section": "13 — Защита от коррозии (АКЗ)", "standard": "ГЭСН", "code": "13-03-004-04",
     "item_name": "Обезжиривание поверхности уайт-спиритом",
     "unit": "м²", "base_price": 38, "work_type": "АКЗ"},
    {"section": "13 — Защита от коррозии (АКЗ)", "standard": "ГЭСН", "code": "13-03-004-15",
     "item_name": "Грунтование металлоконструкций ВЛ-02 за 1 раз",
     "unit": "м²", "base_price": 95, "work_type": "АКЗ"},
    {"section": "13 — Защита от коррозии (АКЗ)", "standard": "ГЭСН", "code": "13-03-004-26",
     "item_name": "Окраска металлоконструкций эмалью ПФ-115 за 2 раза",
     "unit": "м²", "base_price": 165, "work_type": "АКЗ"},
    {"section": "13 — Защита от коррозии (АКЗ)", "standard": "ГЭСН", "code": "13-03-004-30",
     "item_name": "Окраска металлоконструкций эпоксидной эмалью",
     "unit": "м²", "base_price": 285, "work_type": "АКЗ"},

    # Металлоконструкции (раздел 09)
    {"section": "09 — Металлоконструкции", "standard": "ГЭСН", "code": "09-03-002-01",
     "item_name": "Монтаж стальных конструкций массой до 3 т",
     "unit": "т", "base_price": 28500, "work_type": "Монолит"},
    {"section": "09 — Металлоконструкции", "standard": "ГЭСН", "code": "09-03-014-01",
     "item_name": "Изготовление и установка лестниц металлических",
     "unit": "т", "base_price": 65300, "work_type": "Усиление"},
    {"section": "09 — Металлоконструкции", "standard": "ГЭСН", "code": "09-03-029-04",
     "item_name": "Монтаж металлических ограждений",
     "unit": "т", "base_price": 18900, "work_type": "Монолит"},
    {"section": "09 — Металлоконструкции", "standard": "ГЭСН", "code": "09-03-015-02",
     "item_name": "Замена изношенных элементов металлоконструкций",
     "unit": "т", "base_price": 35700, "work_type": "Усиление"},

    # Кровли (раздел 12)
    {"section": "12 — Кровли", "standard": "ГЭСН", "code": "12-01-002-04",
     "item_name": "Устройство кровли из профлиста",
     "unit": "м²", "base_price": 680, "work_type": "Кровля"},
    {"section": "12 — Кровли", "standard": "ГЭСН", "code": "12-01-015-01",
     "item_name": "Устройство кровли из рулонных битумно-полимерных материалов",
     "unit": "м²", "base_price": 520, "work_type": "Кровля"},
    {"section": "12 — Кровли", "standard": "ГЭСН", "code": "12-01-007-01",
     "item_name": "Ремонт кровли с заменой кровельного покрытия (АКЗ)",
     "unit": "м²", "base_price": 740, "work_type": "Кровля"},

    # Леса и подмости (раздел 09 / общие)
    {"section": "09 — Металлоконструкции", "standard": "ГЭСН", "code": "09-05-010-01",
     "item_name": "Установка и разборка инвентарных лесов высотой до 16 м",
     "unit": "м²", "base_price": 420, "work_type": "Промальп"},
    {"section": "09 — Металлоконструкции", "standard": "ГЭСН", "code": "09-05-010-04",
     "item_name": "Установка и разборка лесов внутренних в помещениях h до 10м",
     "unit": "м²", "base_price": 285, "work_type": "Промальп"},

    # Бетон (раздел 06)
    {"section": "06 — Бетон/железобетон монолитный", "standard": "ГЭСН", "code": "06-01-001-01",
     "item_name": "Устройство бетонной подготовки",
     "unit": "м³", "base_price": 4850, "work_type": "Монолит"},
    {"section": "06 — Бетон/железобетон монолитный", "standard": "ГЭСН", "code": "06-01-026-01",
     "item_name": "Устройство монолитных железобетонных стен",
     "unit": "м³", "base_price": 12700, "work_type": "Монолит"},

    # Трубопроводы (раздел 16)
    {"section": "16 — Трубопроводы внутренние", "standard": "ГЭСН", "code": "16-04-002-01",
     "item_name": "Прокладка трубопроводов оцинкованных Ø 50 мм",
     "unit": "м", "base_price": 580, "work_type": "Инженерные сети"},
    {"section": "16 — Трубопроводы внутренние", "standard": "ГЭСН", "code": "16-07-005-04",
     "item_name": "Изоляция трубопроводов минераловатными матами",
     "unit": "м²", "base_price": 320, "work_type": "Инженерные сети"},

    # Отделка (раздел 15)
    {"section": "15 — Отделочные работы", "standard": "ГЭСН", "code": "15-04-024-01",
     "item_name": "Окраска ранее окрашенных поверхностей водоэмульсионными составами",
     "unit": "м²", "base_price": 215, "work_type": "Комплексный"},
    {"section": "15 — Отделочные работы", "standard": "ГЭСН", "code": "15-04-005-01",
     "item_name": "Облицовка стен керамической плиткой",
     "unit": "м²", "base_price": 1850, "work_type": "Комплексный"},
]


@frappe.whitelist()
def seed_catalog(force: bool = False) -> dict:
    """Загружает базовый каталог расценок (одноразово).

    Если в БД уже >0 позиций — пропускает (не дублирует), пока не передан force=True.
    """
    frappe.has_permission("Cost Catalog Item", "create", throw=True)

    existing = frappe.db.count("Cost Catalog Item")
    if existing > 0 and not force:
        return {"skipped": True, "existing": existing, "message": "В каталоге уже есть позиции"}

    created = 0
    for item in _SEED_DATA:
        # Проверка на существование по коду + наименованию
        if frappe.db.exists("Cost Catalog Item", {"code": item["code"], "item_name": item["item_name"]}):
            continue
        doc = frappe.get_doc({"doctype": "Cost Catalog Item", "is_active": 1, **item})
        doc.insert(ignore_permissions=True)
        created += 1

    frappe.db.commit()
    return {"created": created, "total_seed": len(_SEED_DATA)}


# ────────────────────────── DDC CWICR импорт ─────────────────────────────────


@frappe.whitelist()
def get_resources(
    search: str | None = None,
    resource_type: str | None = None,
    collection: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """Список ресурсов из CWICR-каталога с фильтрами."""
    frappe.has_permission("Catalog Resource", throw=True)

    filters: dict = {}
    if resource_type:
        filters["resource_type"] = resource_type
    if collection:
        filters["parent_collection"] = collection

    or_filters = {}
    if search:
        or_filters = {
            "resource_name": ["like", f"%{search}%"],
            "resource_code": ["like", f"%{search}%"],
        }

    return frappe.get_all(
        "Catalog Resource",
        filters=filters,
        or_filters=or_filters,
        fields=[
            "name", "resource_code", "resource_name", "resource_type",
            "unit", "price_avg", "price_min", "price_max", "currency",
            "parent_collection", "parent_category", "usage_count",
        ],
        order_by="usage_count desc",
        limit=int(limit),
    )


@frappe.whitelist()
def get_resource_stats() -> dict:
    """Сводка по CWICR-каталогу ресурсов."""
    frappe.has_permission("Catalog Resource", throw=True)

    total = frappe.db.count("Catalog Resource")
    if total == 0:
        return {"total": 0, "by_type": {}, "by_collection": [], "loaded": False}

    by_type = frappe.db.sql(
        """SELECT resource_type, COUNT(*) cnt
           FROM `tabCatalog Resource`
           GROUP BY resource_type ORDER BY cnt DESC""",
        as_dict=True,
    )
    by_collection = frappe.db.sql(
        """SELECT parent_collection, COUNT(*) cnt
           FROM `tabCatalog Resource`
           WHERE parent_collection IS NOT NULL AND parent_collection != ''
           GROUP BY parent_collection ORDER BY cnt DESC LIMIT 20""",
        as_dict=True,
    )
    return {
        "total": total,
        "loaded": True,
        "by_type": {r["resource_type"]: r["cnt"] for r in by_type},
        "by_collection": by_collection,
    }


def _trunc(s: str | None, max_len: int) -> str:
    """Обрезает строку до max_len символов с suffix '…'."""
    if not s:
        return ""
    s = s.strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


@frappe.whitelist()
def import_cwicr(
    file_path: str | None = None,
    limit: int | None = None,
    skip_existing: bool = True,
    batch_size: int = 500,
) -> dict:
    """ETL-импорт DDC CWICR Catalog (CSV из репозитория datadrivenconstruction).

    Источник: OpenConstructionEstimate-DDC-CWICR (CC BY 4.0, региона С-Пб).
    file_path по умолчанию ищется в /home/frappe/frappe-bench/test_data/cwicr_ru_catalog.csv
    либо в смонтированном volume /workspace/test_data/.

    Args:
        file_path: путь к CSV
        limit: импортировать не более N строк (для тестов; None = все)
        skip_existing: пропускать уже существующие resource_code
        batch_size: после скольких записей делать commit

    Returns: {"created": N, "skipped": N, "errors": [..], "total_rows": N}
    """
    frappe.has_permission("Catalog Resource", "create", throw=True)

    candidates = [
        file_path,
        "/home/frappe/frappe-bench/apps/olimp_construction/test_data/cwicr_ru_catalog.csv",
        "/workspace/test_data/cwicr_ru_catalog.csv",
        "/home/frappe/frappe-bench/sites/test_data/cwicr_ru_catalog.csv",
    ]
    resolved = None
    for c in candidates:
        if c and os.path.isfile(c):
            resolved = c
            break
    if not resolved:
        frappe.throw(_(f"CSV-файл не найден. Пробовал: {candidates}"))

    created = 0
    skipped = 0
    errors: list[str] = []
    total = 0

    with open(resolved, encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for i, row in enumerate(reader):
            total += 1
            if limit and total > int(limit):
                break

            code = (row.get("resource_code") or "").strip()
            name = (row.get("name") or "").strip()
            if not code or not name:
                continue

            if skip_existing and frappe.db.exists("Catalog Resource", code):
                skipped += 1
                continue

            try:
                doc = frappe.get_doc({
                    "doctype": "Catalog Resource",
                    "resource_code": code,
                    "resource_name": _trunc(name, 500),
                    "resource_type": (row.get("type") or "Material").strip(),
                    "unit": _trunc(row.get("unit"), 20),
                    "category": _trunc(row.get("category"), 140),
                    "price_avg": flt(row.get("price_avg") or 0),
                    "price_min": flt(row.get("price_min") or 0),
                    "price_max": flt(row.get("price_max") or 0),
                    "price_median": flt(row.get("price_median") or 0),
                    "price_variants": int(flt(row.get("price_variants") or 0)),
                    "currency": (row.get("currency") or "RUB").strip(),
                    "avg_cost_per_use": flt(row.get("avg_cost_per_use") or 0),
                    "avg_qty_per_use": flt(row.get("avg_qty_per_use") or 0),
                    "usage_count": int(flt(row.get("usage_count") or 0)),
                    "used_in_work_items": int(flt(row.get("used_in_work_items") or 0)),
                    "parent_category": _trunc(row.get("parent_category"), 140),
                    "parent_collection": _trunc(row.get("parent_collection"), 140),
                    "parent_department": _trunc(row.get("parent_department"), 500),
                    "parent_section": _trunc(row.get("parent_section"), 500),
                    "region": "Санкт-Петербург",
                    "source": "DDC CWICR (CC BY 4.0)",
                    "regional_factor": 1.0,
                })
                doc.insert(ignore_permissions=True)
                created += 1

                if created % int(batch_size) == 0:
                    frappe.db.commit()
                    frappe.logger().info(f"CWICR: imported {created} rows...")
            except Exception as e:
                errors.append(f"Row {i} ({code}): {str(e)[:120]}")
                if len(errors) > 50:
                    errors.append("... (truncated, more errors)")
                    break

    frappe.db.commit()
    return {
        "created": created,
        "skipped": skipped,
        "total_rows": total,
        "errors_count": len(errors),
        "errors": errors[:10],  # первые 10 ошибок
        "file": resolved,
    }
