"""Семантический поиск по каталогу ресурсов (Catalog Resource) через OpenAI embeddings + Qdrant.

Эндпоинты:
- get_status() — статистика индекса в Qdrant
- reindex_catalog(reset=False) — переиндексация всех Catalog Resource
- search(query, limit, category?, resource_type?) — семантический поиск

Стоимость: text-embedding-3-small = $0.020 / 1M токенов.
Один ресурс ≈ 15 токенов → весь каталог 6 670 шт = ~100K токенов = ~$0.002 / переиндексация.
"""
from __future__ import annotations

import frappe
from frappe.utils import flt

from olimp_construction.ai_services.embeddings import create_embedding, create_embeddings_batch
from olimp_construction.ai_services.qdrant_client import (
    CATALOG_COLLECTION,
    ensure_catalog_collection,
    reset_catalog_collection,
    upsert_catalog_points,
    search_catalog,
    get_catalog_status,
)


def _make_text(row: dict) -> str:
    """Текст для embedding: имя + категория + коллекция (для семантики)."""
    parts = [
        row.get("resource_name") or "",
        row.get("parent_category") or "",
        row.get("parent_collection") or "",
        row.get("resource_type") or "",
    ]
    return " · ".join(p.strip() for p in parts if p and p.strip())


# ── Status ───────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_status() -> dict:
    """Состояние индекса каталога в Qdrant + сводка из БД."""
    total_in_db = frappe.db.count("Catalog Resource")
    qdrant_status = get_catalog_status()
    return {
        "qdrant": qdrant_status,
        "total_in_db": total_in_db,
        "collection_name": CATALOG_COLLECTION,
        "synced": qdrant_status.get("points_count", 0) >= total_in_db and total_in_db > 0,
    }


# ── Reindex ──────────────────────────────────────────────────────────────────

@frappe.whitelist()
def reindex_catalog(reset: int | bool = 0, batch_size: int = 96) -> dict:
    """Перестроить индекс семантического поиска для всех Catalog Resource.

    Параметры:
    - reset=1 — пересоздать коллекцию (на случай смены модели/размерности)
    - batch_size — сколько ресурсов отправлять в OpenAI за раз (макс ~2048)
    """
    frappe.has_permission("Catalog Resource", "read", throw=True)

    if int(reset or 0):
        reset_catalog_collection()
    else:
        ensure_catalog_collection()

    rows = frappe.db.sql(
        """
        SELECT name, resource_code, resource_name, resource_type, unit,
               price_avg, currency, parent_category, parent_collection, parent_department
        FROM `tabCatalog Resource`
        WHERE resource_name IS NOT NULL AND resource_name != ''
        ORDER BY name ASC
        """,
        as_dict=True,
    )

    total = len(rows)
    if total == 0:
        return {"ok": True, "total": 0, "processed": 0, "message": "В каталоге нет ресурсов для индексации"}

    processed = 0
    batch_size = max(1, min(int(batch_size), 1024))

    # Qdrant ID — порядковый int от 1
    for i in range(0, total, batch_size):
        batch = rows[i : i + batch_size]
        texts = [_make_text(r) for r in batch]

        # Пропускаем пустые
        valid_pairs = [(idx, r, t) for idx, (r, t) in enumerate(zip(batch, texts)) if t]
        if not valid_pairs:
            continue

        try:
            embeddings = create_embeddings_batch([t for _, _, t in valid_pairs])
        except Exception as e:
            frappe.logger().error(f"OpenAI embeddings failed at batch {i}: {e}")
            raise

        points: list[dict] = []
        for (idx_in_batch, r, _), emb in zip(valid_pairs, embeddings):
            qid = i + idx_in_batch + 1  # 1-based unique int
            points.append(
                {
                    "id": qid,
                    "vector": emb,
                    "payload": {
                        "doc_name": r["name"],
                        "resource_code": r.get("resource_code") or "",
                        "resource_name": r["resource_name"],
                        "resource_type": r.get("resource_type") or "",
                        "unit": r.get("unit") or "",
                        "price_avg": flt(r.get("price_avg") or 0),
                        "currency": r.get("currency") or "RUB",
                        "category": r.get("parent_category") or "",
                        "collection": r.get("parent_collection") or "",
                        "department": r.get("parent_department") or "",
                    },
                }
            )

        upsert_catalog_points(points)
        processed += len(points)

    return {
        "ok": True,
        "total": total,
        "processed": processed,
        "collection": CATALOG_COLLECTION,
    }


# ── Search ───────────────────────────────────────────────────────────────────

@frappe.whitelist()
def search(
    query: str,
    limit: int = 10,
    category: str | None = None,
    resource_type: str | None = None,
) -> list[dict]:
    """Семантический поиск ресурсов по естественно-языковому запросу."""
    frappe.has_permission("Catalog Resource", "read", throw=True)

    if not query or len(query.strip()) < 2:
        return []

    try:
        emb = create_embedding(query.strip())
    except Exception as e:
        # Поднимем понятную ошибку в UI
        frappe.throw(f"Не удалось создать embedding запроса: {e}")

    try:
        hits = search_catalog(
            vector=emb,
            limit=int(limit),
            category=category or None,
            resource_type=resource_type or None,
        )
    except Exception as e:
        frappe.throw(f"Qdrant search failed: {e}")

    out: list[dict] = []
    for h in hits:
        p = h.payload or {}
        out.append({
            "doc_name": p.get("doc_name"),
            "resource_code": p.get("resource_code"),
            "resource_name": p.get("resource_name"),
            "resource_type": p.get("resource_type"),
            "unit": p.get("unit"),
            "price_avg": p.get("price_avg"),
            "currency": p.get("currency"),
            "category": p.get("category"),
            "collection": p.get("collection"),
            "score": round(float(h.score), 4),
        })
    return out
