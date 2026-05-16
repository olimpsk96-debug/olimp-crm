"""Rule-based Lead Scoring (HubSpot/Pipedrive подход).

Каждое правило даёт балл +/-. Сумма → Grade:
- A: 85+  (горячий, требует немедленной работы)
- B: 65+  (тёплый, в нормальной воронке)
- C: 40+  (холодный, нуждается в прогреве)
- D: <40  (бесперспективный, низкий приоритет)
"""
from __future__ import annotations

import json
import re

import frappe
from frappe.utils import flt, now_datetime


# Правила scoring — каждый возвращает (баллы, объяснение)
def score_amount(amount: float) -> tuple[int, str]:
    """Размер сделки — главный фактор для ОЛИМП (профиль 2-30 млн)."""
    if amount >= 30_000_000:
        return 25, "Очень крупный (30М+) — повышенные риски"
    if amount >= 10_000_000:
        return 30, "Крупный (10-30М) — оптимально для нас"
    if amount >= 2_000_000:
        return 25, "Средний (2-10М) — наш профиль"
    if amount >= 500_000:
        return 10, "Малый (0.5-2М) — на грани"
    if amount > 0:
        return -10, "Слишком мелкий (<500К) — нецелесообразно"
    return 0, "Сумма не указана"


def score_source(source: str) -> tuple[int, str]:
    """Источник — Рекомендации > Сайт > Тендер > Звонок."""
    return {
        "Рекомендация":      (25, "Рекомендация — самый качественный канал"),
        "Знакомство":        (20, "По связям"),
        "Сайт":              (15, "Лид с сайта (UTM+)"),
        "Тендер":            (10, "Тендер — холодный, но проф. канал"),
        "Telegram":          (12, "Telegram-бот (тёплый канал)"),
        "Холодный звонок":   (5,  "Холодный звонок"),
        "Прочее":            (5,  "Источник прочее"),
    }.get(source, (0, "Источник не указан"))


def score_company(customer_name: str) -> tuple[int, str]:
    """ИНН/ООО vs физлицо."""
    if not customer_name:
        return 0, "Имя не указано"
    lower = customer_name.lower()
    if any(w in lower for w in ("ооо", "оао", "ао ", "пао", "зао")):
        return 15, "Юрлицо (ООО/АО)"
    if "ип " in lower or lower.startswith("ип "):
        return 8, "ИП"
    return 3, "Физлицо"


def score_status(status: str) -> tuple[int, str]:
    """Текущая стадия воронки — чем дальше тем выше."""
    return {
        "Лид":            5,
        "Переговоры":     15,
        "КП отправлено":  25,
        "Договор":        35,
        "В работе":       40,
        "Закрыт выигран": 50,
        "Закрыт проигран": -20,
    }.get(status, 0), f"Стадия: {status}"


def score_history(customer: str) -> tuple[int, str]:
    """Прошлые сделки с этим клиентом."""
    if not customer:
        return 0, "Без клиента"
    won = frappe.db.count("Deal", {
        "customer": customer, "status": "Закрыт выигран",
    }) or 0
    if won >= 3:
        return 20, f"Постоянный клиент ({won} прошлых сделок)"
    if won >= 1:
        return 12, f"Был успешный кейс ({won})"
    lost = frappe.db.count("Deal", {
        "customer": customer, "status": "Закрыт проигран",
    }) or 0
    if lost >= 2:
        return -10, f"Уже {lost} раз проиграли — может не наш"
    return 0, "Новый клиент"


def score_freshness(last_activity_date) -> tuple[int, str]:
    """Свежесть активности."""
    if not last_activity_date:
        return 0, "Нет данных об активности"
    days = (now_datetime() - last_activity_date).days
    if days <= 1:
        return 10, "Свежий контакт (≤1д)"
    if days <= 7:
        return 5, "Контакт на неделе"
    if days <= 30:
        return 0, "Контакт в этом месяце"
    if days <= 90:
        return -5, f"Молчание {days}д"
    return -15, f"Глубокое молчание {days}д"


def score_completeness(deal: dict) -> tuple[int, str]:
    """Сколько полей заполнено — индикатор активной работы."""
    fields = ["customer", "contact_name", "amount_estimated",
              "expected_close_date", "description"]
    filled = sum(1 for f in fields if deal.get(f))
    if filled >= 4:
        return 10, f"Поля заполнены ({filled}/{len(fields)})"
    if filled >= 2:
        return 3, f"Частично ({filled}/{len(fields)})"
    return -5, f"Пустая карточка ({filled}/{len(fields)})"


def calculate_score(deal: dict) -> dict:
    """Считает score + grade + breakdown."""
    breakdown = []
    total = 0

    pairs = [
        score_amount(flt(deal.get("amount_estimated") or 0)),
        score_source(deal.get("source") or ""),
        score_company(deal.get("customer") or deal.get("contact_name") or ""),
        score_status(deal.get("status") or "Лид"),
        score_history(deal.get("customer") or ""),
        score_freshness(deal.get("last_activity_date")),
        score_completeness(deal),
    ]
    for points, reason in pairs:
        total += points
        breakdown.append({"points": points, "reason": reason})

    # Clamp 0..100
    total = max(0, min(100, total))

    # Grade
    if total >= 85:
        grade = "A"
    elif total >= 65:
        grade = "B"
    elif total >= 40:
        grade = "C"
    else:
        grade = "D"

    return {"score": total, "grade": grade, "breakdown": breakdown}


@frappe.whitelist()
def score_deal(name: str) -> dict:
    """Считает score для одной сделки и обновляет в БД."""
    deal = frappe.get_doc("Deal", name)
    result = calculate_score(deal.as_dict())
    frappe.db.set_value("Deal", name, {
        "lead_score": result["score"],
        "lead_grade": result["grade"],
        "lead_score_breakdown": json.dumps(result["breakdown"], ensure_ascii=False),
    }, update_modified=False)
    frappe.db.commit()
    return result


@frappe.whitelist()
def score_all_deals() -> dict:
    """Пересчитывает scores для всех Deal. Cron daily."""
    deals = frappe.db.sql(
        """SELECT name, customer, contact_name, amount_estimated, source,
                  status, last_activity_date, expected_close_date, description
           FROM `tabDeal`
           WHERE status NOT IN ('Закрыт выигран', 'Закрыт проигран')""",
        as_dict=True,
    )
    updated = 0
    for d in deals:
        result = calculate_score(d)
        frappe.db.set_value("Deal", d["name"], {
            "lead_score": result["score"],
            "lead_grade": result["grade"],
            "lead_score_breakdown": json.dumps(result["breakdown"], ensure_ascii=False),
        }, update_modified=False)
        updated += 1
    frappe.db.commit()
    return {"ok": True, "scored": updated}


@frappe.whitelist()
def get_grades_summary() -> dict:
    """Распределение по Grade для дашборда."""
    frappe.has_permission("Deal", throw=True)
    rows = frappe.db.sql(
        """SELECT lead_grade AS grade, COUNT(*) AS cnt,
                  COALESCE(SUM(amount_estimated), 0) AS amt
           FROM `tabDeal`
           WHERE status NOT IN ('Закрыт выигран', 'Закрыт проигран')
             AND lead_grade IS NOT NULL AND lead_grade != ''
           GROUP BY lead_grade
           ORDER BY FIELD(lead_grade, 'A', 'B', 'C', 'D')""",
        as_dict=True,
    )
    return {"by_grade": rows}
