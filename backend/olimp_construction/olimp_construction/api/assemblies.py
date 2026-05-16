"""API для Construction Assembly — типовые сборки работ Олимпа.

Сборка = переиспользуемый рецепт «столько ресурсов на единицу работы».
Например: «АКЗ группа 3, 2 слоя на 1 м²» = грунт 0.18 кг + эмаль 0.35 кг
+ рабочий 0.4 чел-час. При вставке в смету масштабируется на quantity.
"""
from __future__ import annotations

import frappe


@frappe.whitelist()
def list_assemblies(category: str | None = None, active_only: int = 1,
                    search: str = "", limit: int = 200) -> list[dict]:
    frappe.has_permission("Construction Assembly", throw=True)

    filters: dict = {}
    if int(active_only or 0):
        filters["is_active"] = 1
    if category:
        filters["category"] = category
    if search:
        filters["assembly_name"] = ["like", f"%{search.strip()}%"]

    rows = frappe.get_all(
        "Construction Assembly",
        filters=filters,
        fields=["name", "assembly_code", "assembly_name", "category", "unit",
                "labor_hours", "base_rate", "market_rate", "margin_percent",
                "is_active", "applicable_objects", "modified"],
        order_by="assembly_code ASC",
        limit_page_length=int(limit),
    )

    # Добавим items_count
    for r in rows:
        r["items_count"] = frappe.db.count("Assembly Item", {"parent": r["name"]})
    return rows


@frappe.whitelist()
def get_assembly(name: str) -> dict:
    frappe.has_permission("Construction Assembly", "read", doc=name, throw=True)
    doc = frappe.get_doc("Construction Assembly", name)
    out = doc.as_dict()
    # Items с resolved именами Catalog Resource
    items: list[dict] = []
    for it in (doc.items or []):
        items.append({
            "name": it.name,
            "idx": it.idx,
            "resource_type": it.resource_type,
            "catalog_resource": it.catalog_resource,
            "description": it.description or "",
            "qty_per_unit": float(it.qty_per_unit or 0),
            "unit": it.unit or "",
            "rate": float(it.rate or 0),
            "amount": float(it.amount or 0),
            "notes": it.notes or "",
        })
    out["items"] = items
    return out


@frappe.whitelist()
def save_assembly(name: str | None = None, assembly_code: str = "",
                  assembly_name: str = "", category: str = "Прочее",
                  unit: str = "", labor_hours: float = 0,
                  market_rate: float = 0, description: str = "",
                  applicable_objects: str = "", is_active: int = 1,
                  items: list | str = "") -> dict:
    """Создать/обновить Construction Assembly с items."""
    import json as _json
    if isinstance(items, str):
        items = _json.loads(items) if items else []

    if not assembly_code.strip():
        frappe.throw("assembly_code обязателен")
    if not assembly_name.strip():
        frappe.throw("assembly_name обязателен")
    if not unit.strip():
        frappe.throw("Укажите ед. изм.")

    if name and frappe.db.exists("Construction Assembly", name):
        frappe.has_permission("Construction Assembly", "write", doc=name, throw=True)
        doc = frappe.get_doc("Construction Assembly", name)
        action = "updated"
    else:
        frappe.has_permission("Construction Assembly", "create", throw=True)
        doc = frappe.new_doc("Construction Assembly")
        doc.assembly_code = assembly_code.strip()[:140]
        action = "created"

    doc.assembly_name = assembly_name.strip()[:140]
    doc.category = category or "Прочее"
    doc.unit = unit.strip()[:30]
    doc.labor_hours = float(labor_hours or 0)
    doc.market_rate = float(market_rate or 0)
    doc.description = (description or "")[:5000]
    doc.applicable_objects = (applicable_objects or "")[:500]
    doc.is_active = int(is_active or 0)

    # Items
    doc.items = []
    base_rate = 0.0
    for i, it in enumerate(items, start=1):
        if not isinstance(it, dict):
            continue
        qty = float(it.get("qty_per_unit") or 0)
        rate = float(it.get("rate") or 0)
        amount = qty * rate
        base_rate += amount
        doc.append("items", {
            "idx": i,
            "resource_type": it.get("resource_type", "material"),
            "catalog_resource": it.get("catalog_resource") or None,
            "description": (it.get("description") or "")[:140],
            "qty_per_unit": qty,
            "unit": (it.get("unit") or "")[:30],
            "rate": rate,
            "amount": amount,
            "notes": (it.get("notes") or "")[:140],
        })

    doc.base_rate = round(base_rate, 2)
    if doc.market_rate and base_rate > 0:
        doc.margin_percent = round(((float(doc.market_rate) - base_rate) / base_rate) * 100, 2)

    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name, "action": action,
            "base_rate": float(doc.base_rate or 0),
            "margin_percent": float(doc.margin_percent or 0)}


@frappe.whitelist()
def delete_assembly(name: str) -> dict:
    frappe.has_permission("Construction Assembly", "delete", doc=name, throw=True)
    frappe.delete_doc("Construction Assembly", name, ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist()
def get_categories() -> list[dict]:
    """Список категорий с количеством сборок в каждой."""
    frappe.has_permission("Construction Assembly", throw=True)
    rows = frappe.db.sql("""
        SELECT category, COUNT(*) AS cnt
        FROM `tabConstruction Assembly`
        WHERE is_active = 1
        GROUP BY category
        ORDER BY cnt DESC
    """, as_dict=True)
    return [{"category": r["category"] or "Прочее", "count": int(r["cnt"])} for r in rows]


# ─────────────────────────── Seed типовых сборок Олимпа ─────────────────────


SEED_ASSEMBLIES = [
    {
        "assembly_code": "AKZ-G3-M2",
        "assembly_name": "АКЗ группа 3, 2 слоя — м²",
        "category": "АКЗ / Огнезащита",
        "unit": "м²",
        "labor_hours": 0.4,
        "market_rate": 450,
        "applicable_objects": "Резервуары РВС, металлоконструкции под крышей",
        "description": "Грунт ВЛ-02 + 2 слоя эмали ХС-720. Сухой класс эксплуатации.",
        "items": [
            {"resource_type": "material", "description": "Грунт ВЛ-02",
             "qty_per_unit": 0.18, "unit": "кг", "rate": 280},
            {"resource_type": "material", "description": "Эмаль ХС-720",
             "qty_per_unit": 0.35, "unit": "кг", "rate": 450},
            {"resource_type": "labor", "description": "Маляр АКЗ 4 разряда",
             "qty_per_unit": 0.4, "unit": "ч", "rate": 380},
        ],
    },
    {
        "assembly_code": "AKZ-G5-M2",
        "assembly_name": "АКЗ группа 5, 3 слоя — м²",
        "category": "АКЗ / Огнезащита",
        "unit": "м²",
        "labor_hours": 0.55,
        "market_rate": 720,
        "applicable_objects": "Агрессивная атмосфера (хим/металл), мокрая зона",
        "description": "Эпоксидный грунт + 2 слоя полиуретановой эмали. Срок службы 15 лет.",
        "items": [
            {"resource_type": "material", "description": "Эпоксидный грунт ЭП-0199",
             "qty_per_unit": 0.20, "unit": "кг", "rate": 520},
            {"resource_type": "material", "description": "ПУ-эмаль (2 слоя)",
             "qty_per_unit": 0.55, "unit": "кг", "rate": 720},
            {"resource_type": "labor", "description": "Маляр АКЗ 5 разряда",
             "qty_per_unit": 0.55, "unit": "ч", "rate": 450},
        ],
    },
    {
        "assembly_code": "CFRP-LAYER-M2",
        "assembly_name": "Усиление углеволокном, 1 слой — м²",
        "category": "Усиление углеволокном",
        "unit": "м²",
        "labor_hours": 0.6,
        "market_rate": 6500,
        "applicable_objects": "Усиление плит, балок, колонн ж/б конструкций",
        "description": "Sika CarboDur S или эквивалент. Двухкомпонентная смола Sikadur-330.",
        "items": [
            {"resource_type": "material", "description": "Ламель CarboDur S 1014",
             "qty_per_unit": 1.05, "unit": "м²", "rate": 4200},
            {"resource_type": "material", "description": "Смола Sikadur-330",
             "qty_per_unit": 1.5, "unit": "кг", "rate": 850},
            {"resource_type": "labor", "description": "Промальп-сертифицированный CFRP",
             "qty_per_unit": 0.6, "unit": "ч", "rate": 850},
        ],
    },
    {
        "assembly_code": "METAL-MONT-T",
        "assembly_name": "Монтаж металлоконструкций — т",
        "category": "Монтаж металлоконструкций",
        "unit": "т",
        "labor_hours": 12,
        "market_rate": 38000,
        "applicable_objects": "Балки, колонны, фермы, площадки обслуживания",
        "description": "Монтаж с крана, сварка, грунт.",
        "items": [
            {"resource_type": "labor", "description": "Монтажник МК 4 разряда",
             "qty_per_unit": 8, "unit": "ч", "rate": 420},
            {"resource_type": "labor", "description": "Сварщик НАКС",
             "qty_per_unit": 4, "unit": "ч", "rate": 580},
            {"resource_type": "equipment", "description": "Кран 25т",
             "qty_per_unit": 0.5, "unit": "ч", "rate": 4500},
            {"resource_type": "material", "description": "Электроды Э50А",
             "qty_per_unit": 8, "unit": "кг", "rate": 280},
        ],
    },
    {
        "assembly_code": "ROOFING-NAPL-M2",
        "assembly_name": "Кровля наплавляемая, 2 слоя — м²",
        "category": "Кровельные работы",
        "unit": "м²",
        "labor_hours": 0.25,
        "market_rate": 950,
        "applicable_objects": "Плоские кровли цехов и складов",
        "description": "Праймер + 2 слоя ТехноНИКОЛЬ. Гарантия 5 лет.",
        "items": [
            {"resource_type": "material", "description": "Праймер битумный",
             "qty_per_unit": 0.4, "unit": "кг", "rate": 95},
            {"resource_type": "material", "description": "Линокром ХПП",
             "qty_per_unit": 1.15, "unit": "м²", "rate": 220},
            {"resource_type": "material", "description": "Унифлекс ЭКП",
             "qty_per_unit": 1.15, "unit": "м²", "rate": 320},
            {"resource_type": "labor", "description": "Кровельщик 4 разряда",
             "qty_per_unit": 0.25, "unit": "ч", "rate": 400},
        ],
    },
    {
        "assembly_code": "PROMALP-SHIFT",
        "assembly_name": "Промальп: 1 чел-смена на высоте",
        "category": "Промальп",
        "unit": "чел-смена",
        "labor_hours": 8,
        "market_rate": 12000,
        "applicable_objects": "Высотные работы свыше 5м без лесов",
        "description": "Промальпинист с допуском, включая страховочное снаряжение.",
        "items": [
            {"resource_type": "labor", "description": "Промальпинист 1-3 категория",
             "qty_per_unit": 8, "unit": "ч", "rate": 950},
            {"resource_type": "equipment", "description": "Снаряжение (амортизация)",
             "qty_per_unit": 1, "unit": "смена", "rate": 800},
        ],
    },
    {
        "assembly_code": "BETON-V25-M3",
        "assembly_name": "Бетон В25 F150 W6 в опалубке — м³",
        "category": "Бетонные работы",
        "unit": "м³",
        "labor_hours": 1.5,
        "market_rate": 9800,
        "applicable_objects": "Фундаменты, монолитные перекрытия, стены",
        "description": "Товарный бетон с автомиксера, вибрирование, уход.",
        "items": [
            {"resource_type": "material", "description": "Бетон В25 F150 W6 (товарный)",
             "qty_per_unit": 1.02, "unit": "м³", "rate": 6800},
            {"resource_type": "labor", "description": "Бетонщик 4 разряда",
             "qty_per_unit": 1.0, "unit": "ч", "rate": 420},
            {"resource_type": "labor", "description": "Подсобный рабочий",
             "qty_per_unit": 0.5, "unit": "ч", "rate": 280},
            {"resource_type": "equipment", "description": "Вибратор глубинный",
             "qty_per_unit": 0.3, "unit": "ч", "rate": 250},
        ],
    },
    {
        "assembly_code": "FIRE-R90-M2",
        "assembly_name": "Огнезащита R90 МК — м²",
        "category": "АКЗ / Огнезащита",
        "unit": "м²",
        "labor_hours": 0.6,
        "market_rate": 2200,
        "applicable_objects": "Огнезащита м/к колонн, балок — R90 (1.5 часа)",
        "description": "Вспучивающаяся краска (например, СГК-1) толщиной 1.5-2 мм по DFT.",
        "items": [
            {"resource_type": "material", "description": "Огнезащитная краска СГК-1",
             "qty_per_unit": 1.8, "unit": "кг", "rate": 580},
            {"resource_type": "material", "description": "Грунт ГФ-021",
             "qty_per_unit": 0.15, "unit": "кг", "rate": 220},
            {"resource_type": "labor", "description": "Маляр с допуском огнезащиты",
             "qty_per_unit": 0.6, "unit": "ч", "rate": 480},
        ],
    },
]


@frappe.whitelist()
def seed_olimp_assemblies(force: int = 0) -> dict:
    """Создаёт 8 базовых типовых сборок Олимпа."""
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager", frappe.PermissionError)

    created = updated = skipped = 0
    for tpl in SEED_ASSEMBLIES:
        code = tpl["assembly_code"]
        if frappe.db.exists("Construction Assembly", code):
            if int(force or 0):
                frappe.delete_doc("Construction Assembly", code, force=True,
                                  ignore_permissions=True)
                updated += 1
            else:
                skipped += 1
                continue

        # Рассчитаем base_rate из items
        items = tpl.get("items", [])
        base_rate = sum(float(it["qty_per_unit"]) * float(it["rate"]) for it in items)
        market_rate = float(tpl["market_rate"])
        margin = ((market_rate - base_rate) / base_rate) * 100 if base_rate else 0

        doc = frappe.new_doc("Construction Assembly")
        doc.assembly_code = code
        doc.assembly_name = tpl["assembly_name"]
        doc.category = tpl["category"]
        doc.unit = tpl["unit"]
        doc.labor_hours = tpl["labor_hours"]
        doc.market_rate = market_rate
        doc.base_rate = round(base_rate, 2)
        doc.margin_percent = round(margin, 2)
        doc.description = tpl.get("description", "")
        doc.applicable_objects = tpl.get("applicable_objects", "")
        doc.is_active = 1

        for i, it in enumerate(items, start=1):
            qty = float(it["qty_per_unit"])
            rate = float(it["rate"])
            doc.append("items", {
                "idx": i,
                "resource_type": it["resource_type"],
                "description": it["description"],
                "qty_per_unit": qty,
                "unit": it["unit"],
                "rate": rate,
                "amount": qty * rate,
            })

        doc.insert(ignore_permissions=True)
        created += 1

    frappe.db.commit()
    return {"ok": True, "created": created, "updated": updated, "skipped": skipped,
            "total_target": len(SEED_ASSEMBLIES)}


@frappe.whitelist()
def apply_to_estimate(estimate: str, assembly: str, quantity: float = 1,
                      markup_pct: float = 15) -> dict:
    """Применить Assembly в смету: вставить позиции сборки с масштабом quantity."""
    frappe.has_permission("Estimate", "write", doc=estimate, throw=True)
    if not frappe.db.exists("Construction Assembly", assembly):
        frappe.throw(f"Assembly {assembly} не найден")

    asm = frappe.get_doc("Construction Assembly", assembly)
    est = frappe.get_doc("Estimate", estimate)
    qty = float(quantity or 1)

    # Добавим раздел-метку (item_name обязательный поэтому дублируем)
    est.append("items", {
        "is_section": 1,
        "section_title": f"⊞ Сборка: {asm.assembly_name} ({qty} {asm.unit})",
        "item_name": f"⊞ Сборка: {asm.assembly_name}",
    })

    # Главная позиция (свёрнутый вид сборки)
    base = float(asm.base_rate or 0)
    our = float(asm.market_rate or base * (1 + float(markup_pct) / 100))

    # work_type Estimate Item имеет фиксированные опции — мапим из категории Assembly
    cat = (asm.category or "").lower()
    work_type_map = {
        "акз": "АКЗ", "огнезащита": "АКЗ",
        "кровел": "Кровля",
        "промальп": "Промальп",
        "бетон": "Монолит",
        "усил": "Усиление",
        "углеволокн": "Усиление",
        "монтаж": "Комплексный",
    }
    work_type = ""
    for key, value in work_type_map.items():
        if key in cat:
            work_type = value
            break

    est.append("items", {
        "is_section": 0,
        "item_code": asm.assembly_code,
        "item_name": asm.assembly_name,
        "unit": asm.unit,
        "qty": qty,
        "base_unit_price": base,
        "base_amount": base * qty,
        "our_unit_price": our,
        "our_amount": our * qty,
        "work_type": work_type,
        "notes": f"Из Construction Assembly: {asm.assembly_code}. Категория: {asm.category}",
    })

    est.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "assembly": asm.name,
            "added_amount": our * qty, "estimate_total": float(est.our_total or 0)}
