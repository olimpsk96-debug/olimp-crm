"""Обёртка над Qdrant client для коллекции каталога ресурсов.

Коллекция `olimp_catalog`:
- vector size = 1536 (text-embedding-3-small)
- distance = Cosine
- payload содержит:
    doc_name, resource_code, resource_name, resource_type, unit,
    price_avg, currency, category, collection, department
"""
from __future__ import annotations

import os

CATALOG_COLLECTION = "olimp_catalog"
EMBED_DIM = 1536

_client = None


def get_qdrant():
    global _client
    if _client is None:
        from qdrant_client import QdrantClient
        url = os.getenv("QDRANT_URL", "http://qdrant:6333")
        _client = QdrantClient(url=url, timeout=60)
    return _client


def ensure_catalog_collection() -> bool:
    """Создаёт коллекцию, если её нет. Возвращает True если создана впервые."""
    from qdrant_client.http import models as qm
    c = get_qdrant()
    existing = {col.name for col in c.get_collections().collections}
    if CATALOG_COLLECTION in existing:
        return False
    c.create_collection(
        collection_name=CATALOG_COLLECTION,
        vectors_config=qm.VectorParams(size=EMBED_DIM, distance=qm.Distance.COSINE),
    )
    return True


def reset_catalog_collection() -> None:
    """Полное пересоздание коллекции (для смены модели / dim)."""
    c = get_qdrant()
    try:
        c.delete_collection(CATALOG_COLLECTION)
    except Exception:
        pass
    ensure_catalog_collection()


def upsert_catalog_points(points: list[dict]) -> None:
    """points: [{id: int, vector: list, payload: dict}, ...]"""
    if not points:
        return
    from qdrant_client.http import models as qm
    c = get_qdrant()
    c.upsert(
        collection_name=CATALOG_COLLECTION,
        points=[
            qm.PointStruct(id=p["id"], vector=p["vector"], payload=p["payload"])
            for p in points
        ],
    )


def search_catalog(
    vector: list[float],
    limit: int = 10,
    category: str | None = None,
    resource_type: str | None = None,
) -> list:
    """Семантический поиск с опциональными фильтрами."""
    from qdrant_client.http import models as qm

    must: list = []
    if category:
        must.append(qm.FieldCondition(key="category", match=qm.MatchValue(value=category)))
    if resource_type:
        must.append(qm.FieldCondition(key="resource_type", match=qm.MatchValue(value=resource_type)))

    flt_obj = qm.Filter(must=must) if must else None

    c = get_qdrant()
    return c.search(
        collection_name=CATALOG_COLLECTION,
        query_vector=vector,
        limit=int(limit),
        query_filter=flt_obj,
        with_payload=True,
    )


def get_catalog_status() -> dict:
    """Статистика по коллекции каталога."""
    c = get_qdrant()
    try:
        existing = {col.name for col in c.get_collections().collections}
        if CATALOG_COLLECTION not in existing:
            return {"exists": False, "points_count": 0}
        info = c.get_collection(CATALOG_COLLECTION)
        return {
            "exists": True,
            "points_count": info.points_count,
            "indexed_vectors_count": info.indexed_vectors_count,
            "status": str(info.status),
            "vector_size": EMBED_DIM,
        }
    except Exception as e:
        return {"exists": False, "error": str(e)}
