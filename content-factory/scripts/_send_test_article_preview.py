"""Отправляет в review-чат Telegram превью сгенерированной тестовой статьи."""
import asyncio
import sys
from pathlib import Path

from aiogram import Bot
from aiogram.enums import ParseMode
from aiogram.utils.markdown import markdown_decoration

from pipeline.settings import settings


async def main() -> int:
    article_path = Path("/app/storage/test_runs/_test_crewai_single.md")
    if not article_path.exists():
        print(f"❌ {article_path} not found")
        return 1

    raw = article_path.read_text(encoding="utf-8")
    # Убираем тройные бэктики и frontmatter для превью
    if raw.startswith("```markdown"):
        raw = raw[len("```markdown") :].lstrip("\n")
    if raw.endswith("```"):
        raw = raw[: -3].rstrip()

    lines = raw.split("\n")
    # Найти конец frontmatter (второе '---')
    body_start = 0
    seen = 0
    for i, ln in enumerate(lines):
        if ln.strip() == "---":
            seen += 1
            if seen >= 2:
                body_start = i + 1
                break
    body = "\n".join(lines[body_start:]).strip()

    # Взять первые ~1100 знаков из тела
    preview = body[:1100].rstrip()
    if len(body) > 1100:
        preview += "…"

    # Без parse_mode — обычный текст, надёжнее
    text = (
        "📝 Тестовый черновик статьи готов\n\n"
        f"Тема: Уборка снега и сосулек с крыши в Екатеринбурге\n"
        f"Модель: claude-sonnet-4-6 (CrewAI)\n"
        f"Длина: {len(body)} знаков, ~{len(body.split())} слов\n"
        f"Файл: storage/test_runs/_test_crewai_single.md\n\n"
        "── Превью первых 1100 знаков ──\n\n"
        f"{preview}\n\n"
        "─────────────\n"
        "Это smoke-test пайплайна на 1 агенте-writer. "
        "В production-режиме работает команда из 6 агентов "
        "(researcher → outliner → writer → fact_checker → seo_aeo → editor); "
        "к статье добавляются изображения, Schema.org JSON-LD, "
        "версии для TG/IG/TT и видео-сценарий."
    )

    bot = Bot(token=settings.tg_bot_token)
    try:
        # Telegram лимит — 4096 символов на сообщение
        if len(text) > 4000:
            text = text[:3900] + "…\n\n(усечёно)"
        msg = await bot.send_message(
            chat_id=settings.tg_chat_for_review,
            text=text,
        )
        print(f"✓ Sent preview message_id={msg.message_id}")

        # Отправить файл целиком
        from aiogram.types import FSInputFile

        # Сохранить cleaned версию для отправки как файл
        clean_path = article_path.with_suffix(".clean.md")
        clean_path.write_text(body, encoding="utf-8")

        doc = await bot.send_document(
            chat_id=settings.tg_chat_for_review,
            document=FSInputFile(str(clean_path), filename="article_draft.md"),
            caption="📎 Полный черновик статьи",
        )
        print(f"✓ Sent document message_id={doc.message_id}")
        return 0
    except Exception as e:
        print(f"❌ Failed: {type(e).__name__}: {e}")
        return 1
    finally:
        await bot.session.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
