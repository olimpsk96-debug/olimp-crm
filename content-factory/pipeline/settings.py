"""Глобальные настройки контент-завода — читаются из .env.content."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT / ".env.content"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # LLM
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Models
    writer_model: str = "claude-opus-4-7"
    research_model: str = "claude-sonnet-4-6"
    fact_check_model: str = "claude-haiku-4-5-20251001"
    edit_model: str = "claude-sonnet-4-6"

    # WP
    wp_url: str = "https://promalp-ural.ru"
    wp_url_local: str = "http://promalp.test"
    wp_user: str = ""
    wp_app_password: str = ""
    wp_default_category_id: Optional[int] = None
    wp_default_author_id: Optional[int] = None

    # Telegram
    tg_bot_token: str = ""
    tg_channel_id: str = ""
    tg_chat_for_review: str = ""

    # Infrastructure
    qdrant_url: str = "http://qdrant:6333"
    qdrant_api_key: str = ""
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_bucket: str = "content-factory"
    redis_url: str = "redis://redis:6379/3"
    postgres_url: str = "postgresql://content:content_pwd@content-pg:5432/content"

    # Mode flags
    draft_mode: bool = True
    auto_publish_wp: bool = False
    auto_publish_tg: bool = False
    auto_publish_ig: bool = False
    auto_publish_tt: bool = False
    articles_per_day: int = 2

    # Trend discovery
    serpapi_key: str = ""
    dataforseo_login: str = ""
    dataforseo_password: str = ""
    yandex_direct_token: str = ""
    tenderok_api_key: str = ""

    # Analytics
    gsc_service_account_json: str = "/data/gsc-sa.json"
    gsc_site_url: str = "https://promalp-ural.ru/"
    ga4_property_id: str = ""
    ga4_service_account_json: str = "/data/ga4-sa.json"
    yandex_metrika_token: str = ""
    yandex_metrika_counter_id: str = ""
    yandex_webmaster_token: str = ""
    yandex_webmaster_user_id: str = ""
    yandex_webmaster_host_id: str = ""

    # AI Visibility
    ai_vis_brands: str = "ОЛИМП,olimp,promalp-ural,промальп Екатеринбург"

    @field_validator(
        "wp_default_category_id",
        "wp_default_author_id",
        mode="before",
    )
    @classmethod
    def _empty_str_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


settings = Settings()
PROMPTS_DIR = ROOT / "prompts"
CONFIG_DIR = ROOT / "config"
STORAGE_DIR = ROOT / "storage"
ARTICLES_DIR = STORAGE_DIR / "articles"
ARTICLES_DIR.mkdir(parents=True, exist_ok=True)
