"""CRUD-API для Work Template — чтобы редактировать шаблоны во фронте, а не в админке.

Эндпоинты:
- get_list(category?, source?, is_verified?, search?) — список с фильтрами
- get_detail(name) — шаблон + все его stages
- save_template(data) — создать/обновить (с детьми stages)
- delete_template(name) — удалить
- duplicate_template(name, new_id, new_title) — копировать (часто нужно)
- get_categories() — список категорий с counter
"""
from __future__ import annotations

import json

import frappe


@frappe.whitelist()
def get_list(
    category: str | None = None,
    source: str | None = None,
    is_verified: int | str | None = None,
    search: str | None = None,
) -> list[dict]:
    """Список Work Template с фильтрами."""
    frappe.has_permission("Work Template", throw=True)

    filters: dict = {}
    if category:
        filters["category"] = category
    if source:
        filters["source"] = source
    if is_verified is not None and str(is_verified) != "":
        filters["is_verified"] = int(is_verified)

    or_filters = None
    if search and search.strip():
        s = f"%{search.strip()}%"
        or_filters = [
            ["title", "like", s],
            ["keywords", "like", s],
            ["template_id", "like", s],
        ]

    rows = frappe.get_all(
        "Work Template",
        filters=filters,
        or_filters=or_filters,
        fields=[
            "name", "template_id", "title", "category", "base_unit",
            "typical_volume_min", "typical_volume_max",
            "source", "is_verified", "usage_count", "modified",
        ],
        order_by="is_verified DESC, usage_count DESC, modified DESC",
        limit_page_length=500,
    )

    # Кол-во этапов для каждого
    if rows:
        ids = [r["name"] for r in rows]
        stage_counts = frappe.db.sql(
            """SELECT parent, COUNT(*) AS cnt
               FROM `tabWork Stage Template`
               WHERE parent IN %(ids)s
               GROUP BY parent""",
            {"ids": ids}, as_dict=True,
        )
        sc_map = {r["parent"]: r["cnt"] for r in stage_counts}
        for r in rows:
            r["stages_count"] = sc_map.get(r["name"], 0)

    return rows


@frappe.whitelist()
def get_detail(name: str) -> dict:
    """Шаблон + все этапы."""
    frappe.has_permission("Work Template", "read", doc=name, throw=True)
    doc = frappe.get_doc("Work Template", name)
    out = doc.as_dict()
    # stages уже включены в as_dict() как child table, но для уверенности
    out["stages"] = sorted(
        [s.as_dict() for s in (doc.stages or [])],
        key=lambda s: s.get("stage_order") or 0,
    )
    return out


@frappe.whitelist()
def save_template(data: dict | str) -> dict:
    """Создать/обновить шаблон. data — dict с полями + stages: [...]"""
    if isinstance(data, str):
        data = json.loads(data)

    name = data.get("name") or data.get("template_id")
    is_update = name and frappe.db.exists("Work Template", name)

    if is_update:
        frappe.has_permission("Work Template", "write", doc=name, throw=True)
        doc = frappe.get_doc("Work Template", name)
        # Заменяем stages полностью
        doc.stages = []
        for idx, stage in enumerate(data.get("stages") or [], start=1):
            stage_row = doc.append("stages", {
                **{k: stage.get(k) for k in (
                    "title", "unit", "norm_per_base_unit", "labor_hours_per_unit",
                    "materials_json", "gesn_ref", "catalog_resource", "notes",
                )},
                "stage_order": stage.get("stage_order") or idx,
            })
            # Детальные ресурсы этапа (новая модель)
            for r in (stage.get("resources") or []):
                stage_row.append("resources", {
                    "resource_type": r.get("resource_type") or "Материал",
                    "label": r.get("label") or "",
                    "qty_per_base_unit": r.get("qty_per_base_unit") or 0,
                    "unit": r.get("unit") or "",
                    "catalog_resource": r.get("catalog_resource") or None,
                    "fallback_price": r.get("fallback_price") or 0,
                    "notes": r.get("notes") or "",
                })
        # Обновляем мета-поля
        for k in ("title", "category", "base_unit", "typical_volume_min",
                  "typical_volume_max", "keywords", "description",
                  "source", "is_verified"):
            if k in data:
                setattr(doc, k, data[k])
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"name": doc.name, "updated": True}

    # Create
    frappe.has_permission("Work Template", "create", throw=True)
    if not data.get("template_id"):
        frappe.throw("template_id обязателен")
    if not data.get("title"):
        frappe.throw("title обязателен")
    if not data.get("base_unit"):
        frappe.throw("base_unit обязателен")
    if not data.get("category"):
        frappe.throw("category обязательна")
    if not data.get("keywords"):
        frappe.throw("keywords обязательны (через запятую)")
    if not data.get("stages"):
        frappe.throw("Хотя бы один этап обязателен")

    payload = {k: v for k, v in data.items() if k != "stages"}
    payload["doctype"] = "Work Template"
    payload["stages"] = []
    doc = frappe.get_doc(payload)
    for idx, s in enumerate(data["stages"], start=1):
        stage_row = doc.append("stages", {
            **{k: s.get(k) for k in (
                "title", "unit", "norm_per_base_unit", "labor_hours_per_unit",
                "materials_json", "gesn_ref", "catalog_resource", "notes",
            )},
            "stage_order": s.get("stage_order") or idx,
        })
        for r in (s.get("resources") or []):
            stage_row.append("resources", {
                "resource_type": r.get("resource_type") or "Материал",
                "label": r.get("label") or "",
                "qty_per_base_unit": r.get("qty_per_base_unit") or 0,
                "unit": r.get("unit") or "",
                "catalog_resource": r.get("catalog_resource") or None,
                "fallback_price": r.get("fallback_price") or 0,
                "notes": r.get("notes") or "",
            })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "created": True}


@frappe.whitelist()
def delete_template(name: str) -> dict:
    frappe.has_permission("Work Template", "delete", doc=name, throw=True)
    frappe.delete_doc("Work Template", name, ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "deleted": name}


@frappe.whitelist()
def duplicate_template(name: str, new_id: str, new_title: str | None = None) -> dict:
    """Копировать шаблон с новым template_id и опционально новым title."""
    frappe.has_permission("Work Template", "create", throw=True)
    src = frappe.get_doc("Work Template", name)

    if frappe.db.exists("Work Template", new_id):
        frappe.throw(f"Шаблон с ID '{new_id}' уже существует")

    new_doc = frappe.get_doc({
        "doctype": "Work Template",
        "template_id": new_id,
        "title": new_title or f"{src.title} (копия)",
        "category": src.category,
        "base_unit": src.base_unit,
        "typical_volume_min": src.typical_volume_min,
        "typical_volume_max": src.typical_volume_max,
        "keywords": src.keywords,
        "description": src.description,
        "source": "Ручной ввод",
        "is_verified": 0,  # копия требует проверки
        "stages": [
            {
                "stage_order": s.stage_order,
                "title": s.title,
                "unit": s.unit,
                "norm_per_base_unit": s.norm_per_base_unit,
                "labor_hours_per_unit": s.labor_hours_per_unit,
                "materials_json": s.materials_json,
                "gesn_ref": s.gesn_ref,
                "catalog_resource": s.catalog_resource,
                "notes": s.notes,
            }
            for s in (src.stages or [])
        ],
    })
    new_doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": new_doc.name, "created": True}


@frappe.whitelist()
def get_categories() -> list[dict]:
    """Список категорий с счётчиками."""
    frappe.has_permission("Work Template", throw=True)
    rows = frappe.db.sql(
        """SELECT category, COUNT(*) AS cnt,
                  SUM(CASE WHEN is_verified=1 THEN 1 ELSE 0 END) AS verified
           FROM `tabWork Template`
           WHERE category IS NOT NULL AND category != ''
           GROUP BY category
           ORDER BY cnt DESC""",
        as_dict=True,
    )
    return rows
