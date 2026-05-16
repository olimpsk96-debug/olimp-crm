"""
Раскатывает уже сгенерированную статью на WP + Telegram (MVP-stack).

Использование:
    python -m orchestrator.publish --slug germetizaciya-mezhpanelnyh-shvov
    python -m orchestrator.publish --slug ... --target wp tg
    python -m orchestrator.publish --slug ... --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Optional

import markdown as md_lib
import yaml
from loguru import logger

from pipeline.settings import ARTICLES_DIR, settings
from pipeline.publisher.telegram import TelegramPublisher, _escape_md_v2
from pipeline.publisher.wordpress import WordPressPublisher


def _md_to_html(md_text: str) -> str:
    return md_lib.markdown(
        md_text,
        extensions=["extra", "tables", "fenced_code", "toc", "smarty", "sane_lists"],
    )


def _read_article(slug: str) -> dict:
    art_dir = ARTICLES_DIR / slug
    if not art_dir.exists():
        raise FileNotFoundError(f"Article folder not found: {art_dir}")
    md_text = (art_dir / "article.md").read_text(encoding="utf-8")
    meta = json.loads((art_dir / "meta.json").read_text(encoding="utf-8"))
    return {"slug": slug, "dir": art_dir, "md": md_text, "meta": meta}


def _publish_wp(article: dict, dry_run: bool) -> Optional[dict]:
    if dry_run:
        logger.info(f"[DRY-RUN] WP publish: {article['slug']}")
        return {"dry_run": True}

    if not settings.wp_user or not settings.wp_app_password:
        logger.warning("WP_USER / WP_APP_PASSWORD не настроены — skipping WP")
        return None

    html = _md_to_html(article["md"])
    inputs = article["meta"].get("inputs", {})

    with WordPressPublisher() as wp:
        status = "publish" if not settings.draft_mode and settings.auto_publish_wp else "draft"
        res = wp.create_post(
            title=inputs.get("topic_title", article["slug"]),
            slug=article["slug"],
            content_html=html,
            status=status,
        )
        if res.success:
            logger.success(f"WP {status}: {res.url} (post #{res.post_id})")
            return {"post_id": res.post_id, "url": res.url, "status": status}
        else:
            logger.error(f"WP failed: {res.error}")
            return {"error": res.error}


async def _publish_tg(article: dict, dry_run: bool) -> Optional[dict]:
    if dry_run:
        logger.info(f"[DRY-RUN] TG publish: {article['slug']}")
        return {"dry_run": True}

    if not settings.tg_bot_token or not settings.tg_channel_id:
        logger.warning("TG_BOT_TOKEN / TG_CHANNEL_ID не настроены — skipping TG")
        return None

    inputs = article["meta"].get("inputs", {})
    topic_title = inputs.get("topic_title", article["slug"])

    # MVP: первые 1200 знаков статьи как превью + кнопка на сайт
    md_lines = article["md"].split("\n")
    preview_lines: list[str] = []
    acc = 0
    in_frontmatter = False
    for ln in md_lines:
        if ln.startswith("---"):
            in_frontmatter = not in_frontmatter
            continue
        if in_frontmatter:
            continue
        if ln.startswith("#"):
            continue
        preview_lines.append(ln)
        acc += len(ln) + 1
        if acc > 1000:
            break

    preview_text = "\n".join(preview_lines).strip()
    text = (
        f"*{_escape_md_v2(topic_title)}*\n\n"
        f"{_escape_md_v2(preview_text[:900])}\\.\\.\\.\n\n"
        f"_Полная версия на сайте\\._"
    )

    site_url = f"{settings.wp_url.rstrip('/')}/{article['slug']}/"

    pub = TelegramPublisher()
    try:
        to_review = settings.draft_mode or not settings.auto_publish_tg
        res = await pub.publish_text(
            text,
            site_url=site_url,
            to_review_chat=to_review,
        )
        if res.success:
            target = "review" if to_review else "channel"
            logger.success(f"TG {target}: message #{res.message_id}")
            return {"message_id": res.message_id, "chat_id": res.chat_id, "to_review": to_review}
        else:
            logger.error(f"TG failed: {res.error}")
            return {"error": res.error}
    finally:
        await pub.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True, help="Slug папки в storage/articles/")
    parser.add_argument(
        "--target",
        nargs="+",
        choices=["wp", "tg", "all"],
        default=["all"],
        help="Куда публиковать",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    targets = {"wp", "tg"} if "all" in args.target else set(args.target)

    try:
        article = _read_article(args.slug)
    except FileNotFoundError as e:
        logger.error(str(e))
        return 1

    results = {}
    if "wp" in targets:
        results["wp"] = _publish_wp(article, dry_run=args.dry_run)
    if "tg" in targets:
        results["tg"] = asyncio.run(_publish_tg(article, dry_run=args.dry_run))

    # Сохранить лог публикации в папку статьи
    log_path = article["dir"] / "publish_log.json"
    log_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Publish log: {log_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
