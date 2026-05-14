"""Тонкая обёртка над OpenAI Embeddings API.

Модель: text-embedding-3-small (1536 dim, $0.020 / 1M tokens).
Для каталога из 6 670 ресурсов разовая индексация = ~0.1M токенов = ~$0.002.

Если `OPENAI_API_KEY` не задан — `create_embedding` бросит `frappe.throw` с понятным
сообщением, чтобы пользователь увидел причину в UI.
"""
from __future__ import annotations

import os

import frappe

EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    key = os.getenv("OPENAI_API_KEY") or ""
    if not key.strip():
        frappe.throw(
            "OPENAI_API_KEY не задан в .env (либо пустой). "
            "Добавьте ключ OpenAI и перезапустите backend — "
            "семантический поиск использует text-embedding-3-small (~$0.002 на индексацию всего каталога)."
        )
    from openai import OpenAI
    _client = OpenAI(api_key=key.strip())
    return _client


def create_embedding(text: str) -> list[float]:
    """Создаёт embedding для одного текста."""
    if not text or not text.strip():
        frappe.throw("Пустой текст для embedding")
    client = _get_client()
    r = client.embeddings.create(input=text.strip(), model=EMBED_MODEL)
    return r.data[0].embedding


def create_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Batch — для индексации каталога. OpenAI поддерживает до ~2048 строк за вызов."""
    if not texts:
        return []
    cleaned = [t.strip() for t in texts if t and t.strip()]
    if not cleaned:
        return []
    client = _get_client()
    r = client.embeddings.create(input=cleaned, model=EMBED_MODEL)
    return [d.embedding for d in r.data]
