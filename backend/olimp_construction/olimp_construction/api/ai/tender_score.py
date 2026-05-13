from __future__ import annotations

import os
import json

import frappe
from frappe import _

SYSTEM_PROMPT = """Ты AI-ассистент строительной компании ООО «Олимп» (Екатеринбург).
Компания специализируется на промышленном строительстве:
- АКЗ (антикоррозийная защита резервуаров, металлоконструкций)
- Кровля промышленных объектов
- Промышленный альпинизм
- Монолитные работы
- Усиление конструкций

Профиль компании:
- Регион присутствия: Урал и Западная Сибирь (Свердловская, Тюменская, ХМАО, ЯНАО, Челябинская, Пермская обл.)
- Опыт: 10+ лет, СРО, лицензии на высотные работы
- Оптимальный размер контракта: 2–30 млн ₽ (менее 500 тыс — нецелесообразно, более 100 млн — риски)
- Конкуренты демпингуют на 44-ФЗ, поэтому предпочтительны 223-ФЗ и коммерческие тендеры
- Сильные стороны: скорость, качество АКЗ, работа на действующих объектах без остановки производства

Оцени тендер и верни строго JSON без markdown:
{
  "score": <число 0-100>,
  "recommendation": <"Подать"|"Не подавать"|"Проверить вручную">,
  "analysis": "<3-5 предложений: почему такая оценка, ключевые риски или плюсы>"
}

Критерии оценки:
- 80-100: наш профиль, хороший регион, адекватная цена, 223-ФЗ/коммерческий
- 60-79: подходит, но есть риски (далёкий регион, 44-ФЗ с демпингом, нестандартные работы)
- 40-59: сомнительно, нужна ручная проверка
- 0-39: не наш профиль, слишком мало/много, заведомо невыгодно"""


@frappe.whitelist()
def score_tender(tender_name: str) -> dict:
    """Оценивает тендер через Claude API и сохраняет результат."""
    frappe.has_permission("Tender", throw=True)

    tender = frappe.get_doc("Tender", tender_name)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        frappe.throw(_("ANTHROPIC_API_KEY не задан в переменных окружения"))

    try:
        import anthropic
    except ImportError:
        frappe.throw(_("Пакет anthropic не установлен: pip install anthropic"))

    client = anthropic.Anthropic(api_key=api_key)

    nmck_fmt = f"{tender.nmck / 1_000_000:.1f} млн ₽" if tender.nmck else "не указана"

    user_message = (
        f"Тендер: {tender.title}\n"
        f"Закон: {tender.tender_law or 'не указан'}\n"
        f"Вид работ: {tender.work_type or 'не указан'}\n"
        f"Регион: {tender.region or 'не указан'}\n"
        f"НМЦК: {nmck_fmt}\n"
        f"Дедлайн: {tender.deadline_date}\n"
        + (f"Номер закупки: {tender.purchase_number}\n" if tender.purchase_number else "")
        + (f"Площадка: {tender.platform_url}\n" if tender.platform_url else "")
    )

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        import re
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            frappe.throw(_("Claude вернул некорректный JSON"))
        result = json.loads(match.group())

    score = max(0, min(100, int(result.get("score", 0))))
    recommendation = result.get("recommendation", "Проверить вручную")
    analysis = result.get("analysis", "")

    if recommendation not in ("Подать", "Не подавать", "Проверить вручную"):
        recommendation = "Проверить вручную"

    tender.ai_match_score = score
    tender.ai_recommendation = recommendation
    tender.ai_analysis = analysis
    tender.save(ignore_permissions=True)

    frappe.db.commit()

    return {
        "score": score,
        "recommendation": recommendation,
        "analysis": analysis,
    }
