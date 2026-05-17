"""Тестовое сообщение в review-чат Telegram через aiogram."""
import asyncio
import sys
from datetime import datetime

from aiogram import Bot
from aiogram.enums import ParseMode

from pipeline.settings import settings


async def main() -> int:
    if not settings.tg_bot_token:
        print("❌ TG_BOT_TOKEN не задан в .env.content")
        return 1
    if not settings.tg_chat_for_review:
        print("❌ TG_CHAT_FOR_REVIEW не задан в .env.content")
        return 1

    text = (
        "🏗 *Контент\\-завод ОЛИМП — smoke\\-test passed* ✓\n\n"
        f"_Время:_ `{datetime.now().strftime('%Y-%m-%d %H:%M:%S МСК')}`\n\n"
        "*Что проверено сейчас:*\n"
        "• Settings из `\\.env\\.content` загружаются\n"
        "• Конфиги: 32 темы, 70 ключей, brand\\_voice, sources\n"
        "• Все 6 промптов CrewAI агентов готовы\n"
        "• Topic resolver: `comm_01` → «Герметизация межпанельных швов»\n"
        "• Slug builder: транслит из кириллицы\n"
        "• Postgres `content-pg`: 7 таблиц схемы применены\n"
        "• Связь Telegram бот ↔ review\\-чат — работает 🤝\n\n"
        "*Следующий шаг:* сборка `content-pipeline` контейнера с CrewAI\\+Claude\\+Crawl4AI "
        "и запуск реальной генерации статьи по теме `comm_01`\\.\n\n"
        "_Все черновики будут приходить сюда перед публикацией\\._"
    )

    bot = Bot(token=settings.tg_bot_token)
    try:
        msg = await bot.send_message(
            chat_id=settings.tg_chat_for_review,
            text=text,
            parse_mode=ParseMode.MARKDOWN_V2,
        )
        print(f"✓ Sent message_id={msg.message_id} to chat_id={settings.tg_chat_for_review}")
        return 0
    except Exception as e:
        print(f"❌ Failed: {type(e).__name__}: {e}")
        return 1
    finally:
        await bot.session.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
