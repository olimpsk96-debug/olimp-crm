"""
WordPress publisher через REST API + Application Passwords.

Поддерживает:
- Создание/обновление поста (article)
- Создание/обновление services post type (через REST если включена поддержка)
- Загрузку cover image и inline media
- Установку Yoast SEO meta (title, description, focuskw)
- Вставку Schema.org JSON-LD через ACF поле schema_jsonld_extra
"""
from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx
from loguru import logger

from pipeline.settings import settings


@dataclass
class WPPublishResult:
    success: bool
    post_id: Optional[int] = None
    url: Optional[str] = None
    error: Optional[str] = None
    media_ids: list[int] = None


class WordPressPublisher:
    """Клиент WP REST API для публикации статей."""

    def __init__(self, base_url: Optional[str] = None, user: Optional[str] = None, app_password: Optional[str] = None):
        self.base = (base_url or settings.wp_url).rstrip("/")
        self.user = user or settings.wp_user
        self.app_password = app_password or settings.wp_app_password
        if not self.user or not self.app_password:
            raise ValueError("WP_USER and WP_APP_PASSWORD must be set in .env.content")

        token = base64.b64encode(f"{self.user}:{self.app_password}".encode()).decode()
        self.client = httpx.Client(
            base_url=f"{self.base}/wp-json",
            headers={
                "Authorization": f"Basic {token}",
                "Content-Type": "application/json",
                "User-Agent": "OlimpContentFactory/1.0",
            },
            timeout=httpx.Timeout(60.0),
        )

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.client.close()

    # --- Health ---

    def whoami(self) -> dict[str, Any]:
        r = self.client.get("/wp/v2/users/me")
        r.raise_for_status()
        return r.json()

    # --- Media ---

    def upload_media(self, file_path: Path, alt_text: str = "", caption: str = "", title: str = "") -> int:
        """Загрузить файл в Media Library, вернуть media_id."""
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(file_path)

        with open(file_path, "rb") as f:
            files = {"file": (file_path.name, f, _guess_mime(file_path))}
            data = {}
            if alt_text:
                data["alt_text"] = alt_text
            if caption:
                data["caption"] = caption
            if title:
                data["title"] = title

            # Заголовок Content-Disposition обязателен для WP REST media endpoint
            local_client = httpx.Client(
                base_url=f"{self.base}/wp-json",
                headers={
                    "Authorization": self.client.headers["Authorization"],
                    "User-Agent": "OlimpContentFactory/1.0",
                    "Content-Disposition": f'attachment; filename="{file_path.name}"',
                },
                timeout=httpx.Timeout(120.0),
            )
            try:
                r = local_client.post("/wp/v2/media", files=files, data=data)
                r.raise_for_status()
            finally:
                local_client.close()

        media_id = r.json()["id"]
        logger.info(f"Uploaded media #{media_id}: {file_path.name}")
        return media_id

    # --- Posts ---

    def create_post(
        self,
        *,
        title: str,
        slug: str,
        content_html: str,
        excerpt: str = "",
        status: str = "draft",
        category_ids: Optional[list[int]] = None,
        tag_ids: Optional[list[int]] = None,
        featured_media_id: Optional[int] = None,
        author_id: Optional[int] = None,
        yoast_title: Optional[str] = None,
        yoast_description: Optional[str] = None,
        yoast_focuskw: Optional[str] = None,
        schema_jsonld_extra: Optional[list[dict]] = None,
        post_type: str = "posts",  # "posts" (статья) или "articles" (CPT articles) — слаг REST endpoint
    ) -> WPPublishResult:
        """Создать новый пост. По дефолту status=draft (DRAFT_MODE)."""

        payload: dict[str, Any] = {
            "title": title,
            "slug": slug,
            "content": content_html,
            "excerpt": excerpt,
            "status": status,
        }
        if category_ids:
            payload["categories"] = category_ids
        if tag_ids:
            payload["tags"] = tag_ids
        if featured_media_id:
            payload["featured_media"] = featured_media_id
        if author_id:
            payload["author"] = author_id

        # Yoast SEO meta (через REST API нужен фильтр rest_post_meta_callback или плагин Yoast REST API addon)
        meta = {}
        if yoast_title:
            meta["_yoast_wpseo_title"] = yoast_title
        if yoast_description:
            meta["_yoast_wpseo_metadesc"] = yoast_description
        if yoast_focuskw:
            meta["_yoast_wpseo_focuskw"] = yoast_focuskw
        if schema_jsonld_extra:
            meta["schema_jsonld_extra"] = json.dumps(schema_jsonld_extra, ensure_ascii=False)
        if meta:
            payload["meta"] = meta

        try:
            r = self.client.post(f"/wp/v2/{post_type}", json=payload)
            r.raise_for_status()
            data = r.json()
            return WPPublishResult(success=True, post_id=data["id"], url=data["link"])
        except httpx.HTTPStatusError as e:
            logger.error(f"WP create_post failed: {e.response.status_code} {e.response.text}")
            return WPPublishResult(success=False, error=f"{e.response.status_code}: {e.response.text}")

    def update_post(
        self,
        post_id: int,
        *,
        title: Optional[str] = None,
        content_html: Optional[str] = None,
        excerpt: Optional[str] = None,
        status: Optional[str] = None,
        meta_updates: Optional[dict[str, Any]] = None,
        post_type: str = "posts",
    ) -> WPPublishResult:
        """Обновить существующий пост (используется refresh-агентом)."""
        payload: dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if content_html is not None:
            payload["content"] = content_html
        if excerpt is not None:
            payload["excerpt"] = excerpt
        if status is not None:
            payload["status"] = status
        if meta_updates:
            payload["meta"] = meta_updates

        try:
            r = self.client.post(f"/wp/v2/{post_type}/{post_id}", json=payload)
            r.raise_for_status()
            data = r.json()
            return WPPublishResult(success=True, post_id=data["id"], url=data["link"])
        except httpx.HTTPStatusError as e:
            logger.error(f"WP update_post #{post_id} failed: {e.response.status_code} {e.response.text}")
            return WPPublishResult(success=False, error=f"{e.response.status_code}: {e.response.text}")

    def search_post_by_slug(self, slug: str, post_type: str = "posts") -> Optional[dict[str, Any]]:
        r = self.client.get(f"/wp/v2/{post_type}", params={"slug": slug})
        r.raise_for_status()
        data = r.json()
        return data[0] if data else None


def _guess_mime(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".pdf": "application/pdf",
    }.get(ext, "application/octet-stream")
