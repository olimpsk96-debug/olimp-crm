"""API для поиска и работы с Catalog Work Item (55K расценок CWICR)."""
from __future__ import annotations

import frappe


@frappe.whitelist()
def get_list(
    search: str | None = None,
    category_type: str | None = None,
    department_name: str | None = None,
    row_type: str | None = None,
    is_abstract: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Список Catalog Work Item с фильтрами и поиском.

    Возвращает {items, total, has_more}.
    """
    frappe.has_permission("Catalog Work Item", throw=True)
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    where_parts = ["1=1"]
    params: dict = {}

    if search and search.strip():
        s = f"%{search.strip()}%"
        where_parts.append("(rate_name LIKE %(s)s OR rate_code LIKE %(s)s OR work_composition_text LIKE %(s)s)")
        params["s"] = s
    if category_type:
        where_parts.append("category_type = %(cat)s")
        params["cat"] = category_type
    if department_name:
        where_parts.append("department_name = %(dep)s")
        params["dep"] = department_name
    if row_type:
        where_parts.append("row_type = %(rt)s")
        params["rt"] = row_type
    if is_abstract is not None and str(is_abstract) != "":
        where_parts.append("is_abstract = %(ia)s")
        params["ia"] = int(is_abstract)

    where = " AND ".join(where_parts)

    total = frappe.db.sql(f"SELECT COUNT(*) FROM `tabCatalog Work Item` WHERE {where}", params)[0][0]

    rows = frappe.db.sql(
        f"""SELECT name, rate_code, rate_name, rate_unit,
                   category_type, department_name, section_name, subsection_name,
                   row_type, is_scope, is_abstract, usage_count
            FROM `tabCatalog Work Item`
            WHERE {where}
            ORDER BY usage_count DESC, rate_code ASC
            LIMIT {limit} OFFSET {offset}""",
        params, as_dict=True,
    )

    return {
        "items": rows,
        "total": int(total),
        "has_more": offset + limit < int(total),
        "limit": limit,
        "offset": offset,
    }


@frappe.whitelist()
def get_detail(name: str) -> dict:
    frappe.has_permission("Catalog Work Item", "read", doc=name, throw=True)
    return frappe.db.sql(
        """SELECT * FROM `tabCatalog Work Item` WHERE name = %(n)s""",
        {"n": name}, as_dict=True,
    )[0] if frappe.db.exists("Catalog Work Item", name) else {}


@frappe.whitelist()
def add_to_estimate(rate_code: str, estimate_name: str,
                     qty: float = 1, base_unit_price: float = 0,
                     our_unit_price: float = 0) -> dict:
    """Добавить расценку CWICR строкой в существующую смету.

    Если base_unit_price=0 — оставит пустым (юзер заполнит вручную).
    Если our_unit_price=0 → ставим base × 1.15 (стандартная наценка).
    """
    from frappe.utils import flt
    frappe.has_permission("Catalog Work Item", "read", doc=rate_code, throw=True)
    frappe.has_permission("Estimate", "write", doc=estimate_name, throw=True)

    item = frappe.db.get_value(
        "Catalog Work Item", rate_code,
        ["rate_code", "rate_name", "rate_unit", "work_composition_text",
         "department_name", "section_name"],
        as_dict=True,
    )
    if not item:
        frappe.throw(f"Расценка {rate_code} не найдена")

    est = frappe.get_doc("Estimate", estimate_name)

    base_p = flt(base_unit_price)
    our_p = flt(our_unit_price)
    if base_p and not our_p:
        our_p = base_p * 1.15

    # Заметки: department / section + первые 200 символов состава работ
    notes_parts = []
    if item.get("department_name"):
        notes_parts.append(f"Сборник: {item['department_name']}")
    if item.get("section_name"):
        notes_parts.append(f"Раздел: {item['section_name']}")
    if item.get("work_composition_text"):
        notes_parts.append(f"Состав: {item['work_composition_text'][:300]}")
    notes = " | ".join(notes_parts)[:500] if notes_parts else None

    est.append("items", {
        "item_code": item["rate_code"][:40],
        "item_name": item["rate_name"] or item["rate_code"],
        "unit": item["rate_unit"] or "ед.",
        "qty": flt(qty),
        "base_unit_price": base_p,
        "our_unit_price": our_p,
        "notes": notes,
    })
    est.save(ignore_permissions=True)

    # Инкремент usage_count расценки
    frappe.db.set_value("Catalog Work Item", rate_code,
                       "usage_count", (frappe.db.get_value("Catalog Work Item", rate_code, "usage_count") or 0) + 1,
                       update_modified=False)
    frappe.db.commit()

    return {
        "ok": True,
        "rate_code": rate_code,
        "estimate": estimate_name,
        "item_name": item["rate_name"],
        "qty": flt(qty),
        "amount": round(flt(qty) * our_p, 2),
    }


@frappe.whitelist()
def convert_to_work_template(rate_code: str, template_id: str | None = None,
                              keywords: str | None = None) -> dict:
    """Создаёт Work Template из CWICR-расценки.

    Парсит work_composition_text на этапы через простые правила:
    - Разбиение по точкам, переносам строк, маркерам списков
    - Каждый предложение = один этап с norm=1.0, labor=0 (заполнит пользователь)
    is_verified=0 (требует проверки главного инженера).
    """
    import re
    from frappe.utils import flt

    if "System Manager" not in frappe.get_roles(frappe.session.user) and \
       "Главный инженер" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager / Главный инженер", frappe.PermissionError)

    item = frappe.db.get_value(
        "Catalog Work Item", rate_code,
        ["rate_code", "rate_name", "rate_unit", "category_type",
         "department_name", "section_name", "work_composition_text"],
        as_dict=True,
    )
    if not item:
        frappe.throw(f"Расценка {rate_code} не найдена")

    # Маппинг CWICR category → наш WorkTemplate category enum
    cat_map = {
        "СТРОИТЕЛЬНЫЕ РАБОТЫ": "Прочее",
        "МОНТАЖ ОБОРУДОВАНИЯ": "Монтаж м/к",
        "РЕМОНТНО-СТРОИТЕЛЬНЫЕ РАБОТЫ": "Прочее",
        "ПУСКОНАЛАДОЧНЫЕ РАБОТЫ": "Прочее",
        "КАПИТАЛЬНЫЙ РЕМОНТ ОБОРУДОВАНИЯ": "Прочее",
    }
    category = cat_map.get(item.get("category_type", ""), "Прочее")

    # template_id: если не задан — генерируем из rate_code
    if not template_id:
        safe = re.sub(r"[^a-z0-9_]+", "_", item["rate_code"].lower())[:50]
        template_id = f"cwicr_{safe}"
    if frappe.db.exists("Work Template", template_id):
        frappe.throw(f"Шаблон '{template_id}' уже существует")

    # Парсим состав работ на этапы
    composition = (item.get("work_composition_text") or "").strip()
    stages_raw: list[str] = []
    if composition:
        # Разбивка: точки в конце предложения / переносы строк / маркеры списка
        # Пример: "1. Установка лесов. 2. Зачистка..." → ["Установка лесов", "Зачистка..."]
        parts = re.split(r"(?:(?<=[.!?])\s+(?=[А-ЯA-Z])|\n+|(?:^|\s)\d+[\.\)]\s*|;\s*)", composition)
        for p in parts:
            p = p.strip().strip(".").strip()
            if len(p) >= 5:
                stages_raw.append(p[:300])

    if not stages_raw:
        # Fallback: один этап с названием расценки
        stages_raw = [item.get("rate_name") or item["rate_code"]]

    # Keywords: из названия + section
    if not keywords:
        words = []
        for src in (item.get("rate_name") or "", item.get("section_name") or ""):
            # Берём только русские слова длиннее 3 символов
            for w in re.findall(r"[А-Яа-яёЁ]{4,}", src):
                if w.lower() not in [x.lower() for x in words] and len(words) < 12:
                    words.append(w.lower())
        keywords = ", ".join(words) or item["rate_code"][:50]

    base_unit = item.get("rate_unit") or "ед."

    doc = frappe.get_doc({
        "doctype": "Work Template",
        "template_id": template_id,
        "title": (item.get("rate_name") or item["rate_code"])[:140],
        "category": category,
        "base_unit": base_unit,
        "typical_volume_min": 1,
        "typical_volume_max": 1000,
        "keywords": keywords[:500],
        "description": (
            f"Создано из CWICR-расценки {item['rate_code']}.\n"
            f"Сборник: {item.get('department_name','')}\n"
            f"Раздел: {item.get('section_name','')}\n"
            f"Состав требует проверки главного инженера."
        )[:1000],
        "source": "Импорт из ГЭСН",
        "is_verified": 0,  # черновик
        "stages": [
            {
                "stage_order": idx,
                "title": s,
                "unit": base_unit,
                "norm_per_base_unit": 1.0,
                "labor_hours_per_unit": 0,
                "materials_json": "{}",
                "gesn_ref": item["rate_code"],
                "notes": f"Из CWICR {rate_code}",
            }
            for idx, s in enumerate(stages_raw, start=1)
        ],
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "ok": True,
        "template_id": template_id,
        "stages_count": len(stages_raw),
        "category": category,
        "rate_code": rate_code,
        "is_verified": 0,
        "message": f"Создан шаблон-черновик с {len(stages_raw)} этапами. Проверь и проставь нормы расхода.",
    }


@frappe.whitelist()
def get_facets() -> dict:
    """Список категорий/отделов/типов с счётчиками для фильтров."""
    frappe.has_permission("Catalog Work Item", throw=True)

    categories = frappe.db.sql(
        """SELECT category_type, COUNT(*) AS cnt
           FROM `tabCatalog Work Item`
           WHERE category_type IS NOT NULL AND category_type != ''
           GROUP BY category_type ORDER BY 2 DESC""",
        as_dict=True,
    )
    departments = frappe.db.sql(
        """SELECT department_name, COUNT(*) AS cnt
           FROM `tabCatalog Work Item`
           WHERE department_name IS NOT NULL AND department_name != ''
           GROUP BY department_name ORDER BY 2 DESC
           LIMIT 50""",
        as_dict=True,
    )
    row_types = frappe.db.sql(
        """SELECT row_type, COUNT(*) AS cnt
           FROM `tabCatalog Work Item`
           WHERE row_type IS NOT NULL AND row_type != ''
           GROUP BY row_type ORDER BY 2 DESC""",
        as_dict=True,
    )
    total = frappe.db.sql("SELECT COUNT(*) FROM `tabCatalog Work Item`")[0][0]

    return {
        "total": int(total),
        "categories": categories,
        "departments": departments,
        "row_types": row_types,
    }
