from __future__ import annotations

import os

import frappe
import requests


_TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"

STATUSES_ACTIVE = ("Новый", "Оценивается", "Готовится заявка", "Заявка подана")


def send_message(text: str, chat_id: str | None = None, parse_mode: str = "HTML") -> bool:
    """Отправляет сообщение в Telegram.

    Returns True при успехе, False при ошибке (чтобы cron не падал).
    """
    token = os.getenv("TELEGRAM_BOT_TOKEN") or frappe.conf.get("telegram_bot_token")
    if not token:
        frappe.logger().warning("TELEGRAM_BOT_TOKEN не задан — сообщение не отправлено")
        return False

    if chat_id is None:
        chat_id = os.getenv("TELEGRAM_DIRECTOR_CHAT_ID") or frappe.conf.get(
            "telegram_director_chat_id"
        )
    if not chat_id:
        frappe.logger().warning("TELEGRAM_DIRECTOR_CHAT_ID не задан — сообщение не отправлено")
        return False

    try:
        resp = requests.post(
            _TELEGRAM_API.format(token=token),
            json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as exc:  # noqa: BLE001
        frappe.logger().error(f"Telegram send failed: {exc}")
        return False


def format_deadline_alert(tender: dict, days_left: int) -> str:
    """Формирует текст алерта о дедлайне тендера."""
    urgency = "🔴" if days_left <= 1 else "🟡" if days_left <= 3 else "🔔"
    days_word = _days_word(days_left)

    nmck_fmt = f"{tender['nmck'] / 1_000_000:.1f} млн ₽" if tender.get("nmck") else "—"
    ai_score = tender.get("ai_match_score")
    ai_rec = tender.get("ai_recommendation") or ""
    ai_line = f"\nAI: {ai_score}% → {ai_rec}" if ai_score else ""

    deadline = tender.get("deadline_date") or "—"
    time_part = ""
    if tender.get("deadline_time"):
        t = str(tender["deadline_time"])
        time_part = " " + t[:5]

    return (
        f"{urgency} <b>Дедлайн через {days_left} {days_word}</b>\n\n"
        f"<b>{tender['title']}</b>\n"
        f"НМЦК: {nmck_fmt} | {tender.get('work_type', '—')} | {tender.get('region', '—')}"
        f"{ai_line}\n\n"
        f"📅 Подать до {deadline}{time_part}"
    )


def _days_word(n: int) -> str:
    if n == 1:
        return "день"
    if 2 <= n <= 4:
        return "дня"
    return "дней"
