"""Семантический индекс Work Templates в Qdrant.

Эндпоинты:
- get_status() — статистика индекса шаблонов
- reindex() — переиндексация всех Work Template (требует System Manager)
- search(query, limit, category?) — найти топ шаблонов по описанию работы
"""
from __future__ import annotations

import frappe

from olimp_construction.ai_services.embeddings import create_embedding, create_embeddings_batch
from olimp_construction.ai_services.qdrant_client import (
    WORK_TEMPLATES_COLLECTION,
    ensure_collection,
    reset_collection,
    upsert_points,
    search_collection,
    get_collection_status,
)


def _make_template_text(tpl: dict) -> str:
    """Текст для embedding: title + keywords + category + первые 3 этапа."""
    parts = [
        tpl.get("title") or "",
        tpl.get("category") or "",
        tpl.get("keywords") or "",
        tpl.get("description") or "",
    ]
    # Добавляем названия первых 3 этапов — это очень информативно для семантики
    stage_titles = tpl.get("_stage_titles") or []
    if stage_titles:
        parts.append(" · ".join(stage_titles[:3]))
    return " · ".join(p.strip() for p in parts if p and p.strip())


# ── Status ───────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_status() -> dict:
    total_in_db = frappe.db.count("Work Template", filters={"is_verified": 1})
    qd = get_collection_status(WORK_TEMPLATES_COLLECTION)
    return {
        "qdrant": qd,
        "total_in_db": total_in_db,
        "collection_name": WORK_TEMPLATES_COLLECTION,
        "synced": qd.get("points_count", 0) >= total_in_db and total_in_db > 0,
    }


# ── Reindex ──────────────────────────────────────────────────────────────────

@frappe.whitelist()
def reindex(reset: int | bool = 1) -> dict:
    """Перестроить семантический индекс шаблонов. Только System Manager."""
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager может перестроить индекс шаблонов", frappe.PermissionError)

    if int(reset or 0):
        reset_collection(WORK_TEMPLATES_COLLECTION)
    else:
        ensure_collection(WORK_TEMPLATES_COLLECTION)

    templates = frappe.get_all(
        "Work Template",
        filters={"is_verified": 1},
        fields=["name", "title", "category", "base_unit", "keywords", "description"],
    )
    if not templates:
        return {"ok": True, "total": 0, "message": "Нет верифицированных шаблонов"}

    # Подтянем первые 3 этапа для каждого шаблона — обогатит семантику
    for t in templates:
        stages = frappe.db.sql(
            """SELECT title FROM `tabWork Stage Template`
               WHERE parent=%(p)s ORDER BY stage_order ASC LIMIT 3""",
            {"p": t["name"]}, as_dict=True,
        )
        t["_stage_titles"] = [s["title"] for s in stages]

    texts = [_make_template_text(t) for t in templates]
    embeddings = create_embeddings_batch(texts)

    points = []
    for idx, (t, emb) in enumerate(zip(templates, embeddings), start=1):
        points.append({
            "id": idx,
            "vector": emb,
            "payload": {
                "template_id": t["name"],
                "title": t["title"],
                "category": t.get("category") or "",
                "base_unit": t.get("base_unit") or "",
            },
        })
    upsert_points(WORK_TEMPLATES_COLLECTION, points)

    return {"ok": True, "total": len(templates), "indexed": len(points)}


# ── Search ───────────────────────────────────────────────────────────────────

@frappe.whitelist()
def search(query: str, limit: int = 5, category: str | None = None) -> list[dict]:
    frappe.has_permission("Work Template", throw=True)
    if not query or len(query.strip()) < 2:
        return []
    limit = max(1, min(int(limit), 20))

    try:
        emb = create_embedding(query.strip())
    except Exception as e:
        frappe.throw(f"Не удалось создать embedding: {e}")

    hits = search_collection(
        WORK_TEMPLATES_COLLECTION,
        vector=emb,
        limit=limit,
        payload_filter={"category": category} if category else None,
    )

    out = []
    for h in hits:
        p = h.payload or {}
        out.append({
            "template_id": p.get("template_id"),
            "title": p.get("title"),
            "category": p.get("category"),
            "base_unit": p.get("base_unit"),
            "score": round(float(h.score), 4),
        })
    return out
