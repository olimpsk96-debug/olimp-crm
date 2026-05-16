"""
Главная точка входа MVP: trend/topic → research → article → image → publish (WP + TG).

Использование:
    python -m orchestrator.generate_article --topic "Герметизация межпанельных швов"
    python -m orchestrator.generate_article --topic-id comm_01
    python -m orchestrator.generate_article --topic-id comm_01 --publish

Без --publish сохраняет в storage/articles/{slug}/ и отправляет на review-chat в Telegram.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import yaml
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import markdown as md_lib
from loguru import logger

from pipeline.settings import settings, CONFIG_DIR, ARTICLES_DIR
from pipeline.writer.crew import build_crew


def _load_topic(topic_id: Optional[str], topic_title: Optional[str]) -> dict[str, Any]:
    """Найти тему по id в topics.yml или собрать ad-hoc из title."""
    topics_data = yaml.safe_load((CONFIG_DIR / "topics.yml").read_text(encoding="utf-8"))

    if topic_id:
        for cluster_topics in topics_data["topics"].values():
            for item in cluster_topics["items"]:
                if item["id"] == topic_id:
                    return {
                        "topic_title": item["title"],
                        "target_keywords": item.get("target_keywords", []),
                        "cluster": item.get("cluster", ""),
                        "format": item.get("format", "pillar"),
                        "page_type": "service",
                        "audience": "primary",
                        "target_word_count": item.get("target_length", 3000),
                        "target_service_id": item.get("target_service_id"),
                        "topic_meta": item,
                    }
        raise ValueError(f"Topic id '{topic_id}' not found in config/topics.yml")

    if topic_title:
        return {
            "topic_title": topic_title,
            "target_keywords": [topic_title.lower()],
            "cluster": "ad_hoc",
            "format": "pillar",
            "page_type": "guide",
            "audience": "primary",
            "target_word_count": 3000,
            "topic_meta": {},
        }

    raise ValueError("Either --topic or --topic-id must be provided")


def _slugify(text: str) -> str:
    """Простой транслит-slugifier (для папок storage). На WP slug формирует outliner."""
    cyr_map = str.maketrans(
        "абвгдеёжзийклмнопрстуфхцчшщъыьэюя ",
        "abvgdeezhziyklmnoprstufhcchshshyyeyuya-",
    )
    s = text.lower().translate(cyr_map)
    s = re.sub(r"[^a-z0-9-]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:80]


def _save_article(slug: str, content: Any, inputs: dict[str, Any]) -> Path:
    """Сохранить результат CrewAI в storage/articles/{slug}/."""
    art_dir = ARTICLES_DIR / slug
    art_dir.mkdir(parents=True, exist_ok=True)

    # CrewAI result может быть в разных форматах. Сохраняем raw + пытаемся распарсить.
    (art_dir / "raw_output.txt").write_text(str(content), encoding="utf-8")
    (art_dir / "inputs.json").write_text(json.dumps(inputs, ensure_ascii=False, indent=2), encoding="utf-8")
    (art_dir / "meta.json").write_text(
        json.dumps(
            {
                "slug": slug,
                "generated_at": datetime.now().isoformat(),
                "inputs": inputs,
                "crewai_result_type": type(content).__name__,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    # Если CrewAI вернул структурированный объект — попробуем извлечь body_md
    body_md = None
    if hasattr(content, "raw"):
        body_md = str(content.raw)
    else:
        body_md = str(content)

    (art_dir / "article.md").write_text(body_md, encoding="utf-8")

    logger.success(f"Article saved to: {art_dir}")
    return art_dir


def _md_to_html(md_text: str) -> str:
    return md_lib.markdown(
        md_text,
        extensions=["extra", "tables", "fenced_code", "toc", "smarty", "sane_lists"],
    )


async def _publish_to_telegram_review(art_dir: Path, slug: str, topic_title: str) -> None:
    """Отправить preview в review-chat если настроен. Не падать если нет токенов."""
    from pipeline.publisher.telegram import TelegramPublisher, _escape_md_v2

    if not settings.tg_bot_token or not settings.tg_chat_for_review:
        logger.warning("TG_BOT_TOKEN / TG_CHAT_FOR_REVIEW не настроены — skipping review preview")
        return

    preview = (
        f"📝 *Новая статья сгенерирована*\n\n"
        f"*Тема:* {_escape_md_v2(topic_title)}\n"
        f"*Slug:* `{_escape_md_v2(slug)}`\n"
        f"*Папка:* `{_escape_md_v2(str(art_dir))}`\n\n"
        f"Перед публикацией прочитай draft и подтверди\\."
    )
    pub = TelegramPublisher()
    try:
        await pub.publish_text(preview, to_review_chat=True, disable_preview=True)
    finally:
        await pub.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Генерация одной статьи через CrewAI")
    parser.add_argument("--topic", type=str, help="Произвольная тема (ad-hoc)")
    parser.add_argument("--topic-id", type=str, help="ID темы из config/topics.yml (например, comm_01)")
    parser.add_argument("--publish", action="store_true", help="Опубликовать сразу (иначе draft + preview)")
    parser.add_argument("--target-words", type=int, default=None, help="Override target_word_count")
    parser.add_argument("--dry-run", action="store_true", help="Не запускать CrewAI, только проверить inputs")
    args = parser.parse_args()

    if not args.topic and not args.topic_id:
        parser.error("Either --topic or --topic-id must be provided")

    try:
        inputs = _load_topic(args.topic_id, args.topic)
    except Exception as e:
        logger.error(f"Failed to load topic: {e}")
        return 2

    if args.target_words:
        inputs["target_word_count"] = args.target_words

    slug = _slugify(inputs["topic_title"])
    logger.info(f"Starting generation for: {inputs['topic_title']!r} (slug: {slug})")
    logger.info(f"Inputs: {json.dumps(inputs, ensure_ascii=False, indent=2)}")

    if args.dry_run:
        logger.info("Dry-run mode — exit before CrewAI")
        return 0

    if not settings.anthropic_api_key:
        logger.error("ANTHROPIC_API_KEY не настроен в .env.content")
        return 3

    crew = build_crew()
    try:
        result = crew.kickoff(inputs=inputs)
    except Exception:
        logger.exception("CrewAI kickoff failed")
        return 4

    art_dir = _save_article(slug, result, inputs)

    # Превью в Telegram (review chat)
    try:
        asyncio.run(_publish_to_telegram_review(art_dir, slug, inputs["topic_title"]))
    except Exception:
        logger.exception("Telegram review preview failed (non-blocking)")

    if args.publish and settings.auto_publish_wp:
        logger.info("Auto-publishing to WP — not implemented in MVP. Use orchestrator.publish for now.")

    logger.success(f"DONE. Output: {art_dir}")
    print(f"\n--- ARTICLE FOLDER ---\n{art_dir}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
