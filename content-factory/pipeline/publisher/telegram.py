"""
Telegram publisher — публикация в канал @promalp_ural через aiogram 3.x.

Поддерживает:
- Текстовые посты с MarkdownV2
- Медиа-альбомы (cover + 2-3 инфографики)
- Inline-кнопки (CTA → сайт)
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from aiogram import Bot
from aiogram.enums import ParseMode
from aiogram.types import (
    FSInputFile,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InputMediaPhoto,
)
from aiogram.utils.markdown import markdown_decoration
from loguru import logger

from pipeline.settings import settings


@dataclass
class TGPublishResult:
    success: bool
    message_id: Optional[int] = None
    chat_id: Optional[str] = None
    error: Optional[str] = None


def _escape_md_v2(text: str) -> str:
    """Экранирование для MarkdownV2 (символы _ * [ ] ( ) ~ ` > # + - = | { } . !)."""
    return markdown_decoration.quote(text)


class TelegramPublisher:
    def __init__(self, bot_token: Optional[str] = None, channel_id: Optional[str] = None):
        self.token = bot_token or settings.tg_bot_token
        self.channel = channel_id or settings.tg_channel_id
        if not self.token:
            raise ValueError("TG_BOT_TOKEN must be set in .env.content")
        if not self.channel:
            raise ValueError("TG_CHANNEL_ID must be set in .env.content")
        self.bot = Bot(token=self.token)

    async def close(self):
        await self.bot.session.close()

    async def publish_text(
        self,
        text_md: str,
        *,
        site_url: Optional[str] = None,
        site_button_text: str = "Читать на сайте",
        disable_preview: bool = False,
        to_review_chat: bool = False,
    ) -> TGPublishResult:
        chat = settings.tg_chat_for_review if to_review_chat else self.channel

        keyboard = None
        if site_url:
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text=site_button_text, url=site_url)]]
            )

        try:
            msg = await self.bot.send_message(
                chat_id=chat,
                text=text_md,
                parse_mode=ParseMode.MARKDOWN_V2,
                disable_web_page_preview=disable_preview,
                reply_markup=keyboard,
            )
            return TGPublishResult(success=True, message_id=msg.message_id, chat_id=str(chat))
        except Exception as e:
            logger.exception(f"TG publish_text failed: {e}")
            return TGPublishResult(success=False, error=str(e))

    async def publish_media_group(
        self,
        text_md: str,
        media_paths: list[Path],
        *,
        to_review_chat: bool = False,
    ) -> TGPublishResult:
        """Альбом из 2-10 фото. Подпись — на первой фотографии."""
        chat = settings.tg_chat_for_review if to_review_chat else self.channel
        if not 2 <= len(media_paths) <= 10:
            raise ValueError(f"media_group requires 2-10 items, got {len(media_paths)}")

        media = []
        for i, p in enumerate(media_paths):
            media.append(
                InputMediaPhoto(
                    media=FSInputFile(str(p)),
                    caption=text_md if i == 0 else None,
                    parse_mode=ParseMode.MARKDOWN_V2 if i == 0 else None,
                )
            )

        try:
            messages = await self.bot.send_media_group(chat_id=chat, media=media)
            first_id = messages[0].message_id if messages else None
            return TGPublishResult(success=True, message_id=first_id, chat_id=str(chat))
        except Exception as e:
            logger.exception(f"TG publish_media_group failed: {e}")
            return TGPublishResult(success=False, error=str(e))

    async def publish_photo(
        self,
        photo_path: Path,
        caption_md: str,
        *,
        site_url: Optional[str] = None,
        site_button_text: str = "Читать на сайте",
        to_review_chat: bool = False,
    ) -> TGPublishResult:
        chat = settings.tg_chat_for_review if to_review_chat else self.channel
        keyboard = None
        if site_url:
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text=site_button_text, url=site_url)]]
            )
        try:
            msg = await self.bot.send_photo(
                chat_id=chat,
                photo=FSInputFile(str(photo_path)),
                caption=caption_md,
                parse_mode=ParseMode.MARKDOWN_V2,
                reply_markup=keyboard,
            )
            return TGPublishResult(success=True, message_id=msg.message_id, chat_id=str(chat))
        except Exception as e:
            logger.exception(f"TG publish_photo failed: {e}")
            return TGPublishResult(success=False, error=str(e))


def publish_telegram_sync(text_md: str, **kwargs) -> TGPublishResult:
    """Синхронная обёртка для CrewAI tools (которые не async)."""
    async def _run():
        pub = TelegramPublisher()
        try:
            return await pub.publish_text(text_md, **kwargs)
        finally:
            await pub.close()
    return asyncio.run(_run())


__all__ = ["TelegramPublisher", "TGPublishResult", "publish_telegram_sync", "_escape_md_v2"]
