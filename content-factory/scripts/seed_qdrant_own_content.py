"""
Seed-скрипт: выгружает контент WordPress (74 услуги + 31 статью + 7 портфолио + ключевые страницы)
в Qdrant коллекцию `own_content` для RAG writer-агента.

Источники:
- /home/dimaaa/Projects/promalp/ — локальная папка WP с БД доступной через docker exec
- Либо через WP REST API (если задан WP_URL_LOCAL)

Использование:
    python -m scripts.seed_qdrant_own_content                        # REST API режим
    python -m scripts.seed_qdrant_own_content --from-mysql           # читать прямо из MariaDB

Создаёт коллекцию `own_content` если её ещё нет. Использует embeddings BAAI/bge-m3.
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from typing import Iterable, Optional

import httpx
from loguru import logger
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    PointStruct,
    VectorParams,
)
from sentence_transformers import SentenceTransformer

from pipeline.settings import settings

COLLECTION_NAME = "own_content"
EMBED_MODEL_NAME = "BAAI/bge-m3"
EMBED_DIM = 1024  # bge-m3


@dataclass
class WPItem:
    wp_id: int
    post_type: str            # services / articles / portfolio / page
    title: str
    slug: str
    url: str
    excerpt: str
    content_md: str           # plain text после strip_tags
    raw_html: str
    meta: dict


def _html_to_text(html: str) -> str:
    """Очень простая чистка HTML → текст."""
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;|&#160;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _chunk(text: str, chunk_size: int = 1500, overlap: int = 150) -> list[str]:
    """Разбить длинный текст на чанки для embedding'а."""
    text = text.strip()
    if not text:
        return []
    chunks = []
    i = 0
    while i < len(text):
        chunk = text[i : i + chunk_size]
        if chunk:
            chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


def fetch_via_rest(post_type: str, base_url: str) -> Iterable[WPItem]:
    """Выгрузка через WP REST API с пагинацией. Работает без аутентификации для public постов."""
    url = f"{base_url.rstrip('/')}/wp-json/wp/v2/{post_type}"
    page = 1
    with httpx.Client(timeout=60.0) as client:
        while True:
            r = client.get(url, params={"per_page": 50, "page": page, "_embed": 1})
            if r.status_code == 400 and page > 1:
                break
            r.raise_for_status()
            items = r.json()
            if not items:
                break
            for it in items:
                title = it.get("title", {}).get("rendered", "")
                content_html = it.get("content", {}).get("rendered", "")
                excerpt_html = it.get("excerpt", {}).get("rendered", "")
                yield WPItem(
                    wp_id=it["id"],
                    post_type=post_type,
                    title=_html_to_text(title),
                    slug=it.get("slug", ""),
                    url=it.get("link", ""),
                    excerpt=_html_to_text(excerpt_html),
                    content_md=_html_to_text(content_html),
                    raw_html=content_html,
                    meta={"date": it.get("date"), "categories": it.get("categories", [])},
                )
            page += 1
            if len(items) < 50:
                break


def ensure_collection(client: QdrantClient) -> None:
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME in existing:
        logger.info(f"Collection '{COLLECTION_NAME}' already exists")
        return
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
    )
    logger.success(f"Created collection '{COLLECTION_NAME}' (dim={EMBED_DIM})")


def index_items(client: QdrantClient, encoder: SentenceTransformer, items: Iterable[WPItem]) -> int:
    points: list[PointStruct] = []
    next_id = 1
    total_chunks = 0
    for item in items:
        text = item.content_md or item.excerpt
        if not text or len(text) < 100:
            continue
        chunks = _chunk(text)
        if not chunks:
            continue
        vectors = encoder.encode(chunks, normalize_embeddings=True, show_progress_bar=False)
        for idx, (chunk, vec) in enumerate(zip(chunks, vectors)):
            points.append(
                PointStruct(
                    id=next_id,
                    vector=vec.tolist(),
                    payload={
                        "wp_id": item.wp_id,
                        "post_type": item.post_type,
                        "title": item.title,
                        "slug": item.slug,
                        "url": item.url,
                        "chunk_idx": idx,
                        "chunks_total": len(chunks),
                        "text": chunk,
                        "categories": item.meta.get("categories", []),
                    },
                )
            )
            next_id += 1
            total_chunks += 1
            if len(points) >= 64:
                client.upsert(collection_name=COLLECTION_NAME, points=points)
                points = []
        logger.info(f"  Indexed {item.post_type}#{item.wp_id} '{item.title[:60]}…' ({len(chunks)} chunks)")
    if points:
        client.upsert(collection_name=COLLECTION_NAME, points=points)
    return total_chunks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wp-url", default=settings.wp_url_local, help="WP base URL (default: settings.wp_url_local)")
    parser.add_argument(
        "--post-types",
        nargs="+",
        default=["services", "articles", "portfolio", "pages"],
        help="Какие post types выгружать",
    )
    parser.add_argument("--recreate", action="store_true", help="Удалить коллекцию перед индексацией")
    args = parser.parse_args()

    qclient = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)

    if args.recreate:
        try:
            qclient.delete_collection(COLLECTION_NAME)
            logger.warning(f"Deleted collection '{COLLECTION_NAME}'")
        except Exception:
            pass

    ensure_collection(qclient)

    logger.info(f"Loading embedding model: {EMBED_MODEL_NAME}")
    encoder = SentenceTransformer(EMBED_MODEL_NAME)

    total = 0
    for pt in args.post_types:
        logger.info(f"Fetching post_type='{pt}' from {args.wp_url}")
        try:
            count = index_items(qclient, encoder, fetch_via_rest(pt, args.wp_url))
            total += count
            logger.success(f"  Indexed {count} chunks from {pt}")
        except httpx.HTTPStatusError as e:
            logger.error(f"  Failed to fetch {pt}: {e.response.status_code}")

    logger.success(f"DONE. Total chunks indexed: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
