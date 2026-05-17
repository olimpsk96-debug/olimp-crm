"""AI Cost Advisor — Claude генерирует BOQ из описания.

Идея из docs/04-boq-example-ntmk.md: пользователь пишет «Фундаментная плита
7×7×2м из бетона В25 с двойным армированием 30 кг/м³ и 32 анкерами М30
длиной 600мм» → Claude генерирует структурированную смету с разделами,
позициями, количествами и привязкой к существующим Construction Assembly.
"""
from __future__ import annotations

import json
import os
import re

import frappe


SYSTEM_PROMPT = """Ты — главный инженер строительной компании ОЛИМП (Екатеринбург).
Специализация компании: антикоррозионная защита (АКЗ), огнезащита,
монтаж металлоконструкций, бетонные работы, промышленный альпинизм.

Твоя задача: по описанию работ сгенерировать структурированную смету (BOQ)
для коммерческого предложения.

Правила:
1. Раскладывай работы на 3-5 разделов (Подготовительные / Основные / Сопутствующие).
2. Каждая позиция должна иметь:
   - description (что делаем, конкретно)
   - unit (м², м³, т, шт, пог.м, чел-смена)
   - quantity (число)
   - unit_rate (цена за единицу в ₽, рыночная по Уралу)
3. Если работа похожа на одну из наших Construction Assembly — указывай assembly_code.
4. ГЭСН-расценки (position_code) указывай только если знаешь точный шифр.
5. Учитывай российские стандарты: ВЛ-02 / ХС-720 для АКЗ, А500С для арматуры,
   В25 F150 W6 для бетона, СГК-1 для огнезащиты.

Цены ориентируйся как:
- Бетон В25 товарный: 6800 ₽/м³
- Арматура А500С: 70000 ₽/т
- Маляр АКЗ 5 разряда: 450 ₽/ч
- Промальпинист: 950 ₽/ч
- Кран 25т: 4500 ₽/час

Возвращай СТРОГО валидный JSON в формате:
{
  "title": "Название сметы",
  "sections": [
    {"section_code": "1", "section_name": "Подготовительные работы"},
    {"section_code": "2", "section_name": "Основные работы"}
  ],
  "positions": [
    {
      "section_code": "1",
      "position_code": "1.1",
      "description": "Снятие плодородного слоя h=15см",
      "unit": "м²",
      "quantity": 80,
      "unit_rate": 150,
      "assembly_code": null,
      "resource_type": "composite"
    }
  ],
  "summary": "Краткое резюме сметы (1-2 предложения)"
}

Никаких комментариев, только JSON. Никакого Markdown-обрамления ```json."""


def _load_assemblies_context() -> str:
    """Возвращает краткий список наших сборок как контекст для Claude."""
    try:
        rows = frappe.get_all(
            "Construction Assembly",
            filters={"is_active": 1},
            fields=["assembly_code", "assembly_name", "category", "unit",
                    "market_rate", "labor_hours"],
            limit_page_length=50,
        )
        if not rows:
            return ""
        lines = ["Наши готовые сборки (используй assembly_code если работа подходит):"]
        for r in rows:
            lines.append(
                f"- {r['assembly_code']} | {r['assembly_name']} | "
                f"{r['category']} | {r['unit']} | "
                f"{int(r['market_rate'] or 0)} ₽/{r['unit']} | "
                f"{r['labor_hours']} чел-ч"
            )
        return "\n".join(lines)
    except Exception:
        return ""


def _extract_json(text: str) -> dict | None:
    """Парсит JSON из ответа Claude. Допускает markdown-обрамление на всякий случай."""
    text = text.strip()
    # Если ответ обёрнут в ```json ... ``` — снимем
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        text = m.group(1)
    # Иначе берём весь { ... }
    elif text.startswith("{"):
        pass
    else:
        # Найдём первый { до последнего }
        i = text.find("{")
        j = text.rfind("}")
        if i >= 0 and j > i:
            text = text[i:j + 1]
        else:
            return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


@frappe.whitelist()
def generate_boq(description: str, project: str | None = None,
                 customer: str | None = None,
                 region: str = "RU-URAL") -> dict:
    """Сгенерировать BOQ из описания работ через Claude.

    Возвращает draft-JSON (не сохраняет в БД). Пользователь увидит preview,
    может отредактировать и нажать «Создать BOQ».
    """
    frappe.has_permission("BOQ", "create", throw=True)
    if not description or len(description.strip()) < 20:
        frappe.throw("Описание должно быть длиннее 20 символов")

    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        frappe.throw("ANTHROPIC_API_KEY не сконфигурирован в окружении контейнера backend")

    try:
        from anthropic import Anthropic
    except ImportError:
        frappe.throw("anthropic SDK не установлен")

    client = Anthropic(api_key=api_key)
    assemblies_ctx = _load_assemblies_context()

    # System: статичный prompt + ассемблеи (меняются раз в неделю) → кэшируются вместе.
    # User: только описание + регион — варьируются от вызова к вызову.
    system_blocks: list[dict] = [{"type": "text", "text": SYSTEM_PROMPT}]
    if assemblies_ctx:
        system_blocks.append({"type": "text", "text": assemblies_ctx})
    # cache_control на последнем блоке кэширует ВСЁ предыдущее (SYSTEM_PROMPT + assemblies).
    # Экономит ~90% input-токенов на повторных вызовах в течение 5 мин (TTL Anthropic).
    system_blocks[-1]["cache_control"] = {"type": "ephemeral"}

    user_message = (
        f"Регион: {region}.\n\n"
        f"Описание работ:\n{description.strip()}\n\n"
        "Сгенерируй BOQ. Только JSON, без объяснений."
    )

    try:
        response = client.messages.create(
            model="claude-haiku-4-5",  # быстро + дёшево для structured output
            max_tokens=4000,
            system=system_blocks,
            messages=[{"role": "user", "content": user_message}],
        )
    except Exception as e:
        frappe.log_error(f"AI BOQ generation failed: {e}", "boq_advisor")
        frappe.throw(f"Ошибка Claude API: {e}")

    if not response.content or not response.content[0].text:
        frappe.throw("Claude вернул пустой ответ")

    raw_text = response.content[0].text
    parsed = _extract_json(raw_text)
    if not parsed:
        frappe.log_error(f"Не удалось распарсить JSON: {raw_text[:500]}", "boq_advisor")
        frappe.throw("Claude вернул невалидный JSON. Попробуй ещё раз или сформулируй точнее.")

    # Валидация структуры
    if not isinstance(parsed.get("sections"), list) or not isinstance(parsed.get("positions"), list):
        frappe.throw("AI вернул некорректную структуру (нет sections/positions)")

    # Считаем итог
    direct_cost = sum(
        float(p.get("quantity", 0) or 0) * float(p.get("unit_rate", 0) or 0)
        for p in parsed["positions"]
    )

    # Маркируем валидные assembly_code
    asm_codes = set(frappe.get_all("Construction Assembly", pluck="assembly_code"))
    matched_count = 0
    for p in parsed["positions"]:
        if p.get("assembly_code") and p["assembly_code"] in asm_codes:
            matched_count += 1
        else:
            p["assembly_code"] = None  # очищаем невалидные

    return {
        "ok": True,
        "title": parsed.get("title") or "BOQ из AI",
        "summary": parsed.get("summary") or "",
        "sections": parsed["sections"],
        "positions": parsed["positions"],
        "direct_cost": direct_cost,
        "matched_assemblies": matched_count,
        "total_positions": len(parsed["positions"]),
        "ai_model": response.model,
        "tokens_used": {
            "input": response.usage.input_tokens if response.usage else 0,
            "output": response.usage.output_tokens if response.usage else 0,
            "cache_read": getattr(response.usage, "cache_read_input_tokens", 0) if response.usage else 0,
            "cache_write": getattr(response.usage, "cache_creation_input_tokens", 0) if response.usage else 0,
        },
        "project": project, "customer": customer,
    }


@frappe.whitelist()
def save_generated_boq(title: str, sections: list | str, positions: list | str,
                      summary: str = "", project: str | None = None,
                      customer: str | None = None,
                      tender: str | None = None,
                      overhead_percent: float = 8,
                      profit_percent: float = 15,
                      contingency_percent: float = 5,
                      vat_percent: float = 20) -> dict:
    """Сохранить AI-сгенерированный BOQ в БД."""
    frappe.has_permission("BOQ", "create", throw=True)

    if isinstance(sections, str):
        sections = json.loads(sections)
    if isinstance(positions, str):
        positions = json.loads(positions)
    if not isinstance(sections, list) or not isinstance(positions, list):
        frappe.throw("sections/positions должны быть списками")

    doc = frappe.new_doc("BOQ")
    doc.title = (title or "BOQ из AI")[:140]
    doc.project = project or None
    doc.customer = customer or None
    doc.version = 1
    doc.status = "Draft"
    doc.boq_date = frappe.utils.nowdate()
    doc.overhead_percent = float(overhead_percent or 0)
    doc.profit_percent = float(profit_percent or 0)
    doc.contingency_percent = float(contingency_percent or 0)
    doc.vat_percent = float(vat_percent or 0)
    notes_parts = ["Сгенерировано AI Cost Advisor."]
    if tender:
        notes_parts.append(f"Источник: тендер {tender}")
    if summary:
        notes_parts.append(summary)
    doc.notes = "\n\n".join(notes_parts)

    # Секции
    for s in sections:
        if not isinstance(s, dict):
            continue
        doc.append("sections", {
            "section_code": str(s.get("section_code") or "")[:50],
            "section_name": str(s.get("section_name") or "Раздел")[:140],
            "subtotal": 0,
            "positions_count": 0,
        })

    # Позиции + посчитаем direct_cost
    direct_cost = 0.0
    for p in positions:
        if not isinstance(p, dict):
            continue
        qty = float(p.get("quantity", 0) or 0)
        rate = float(p.get("unit_rate", 0) or 0)
        total = qty * rate
        direct_cost += total
        doc.append("positions", {
            "section_code": str(p.get("section_code") or "")[:50],
            "position_code": str(p.get("position_code") or "")[:140],
            "description": str(p.get("description") or "")[:500],
            "assembly": p.get("assembly_code") or None,
            "unit": str(p.get("unit") or "шт")[:30],
            "quantity": qty,
            "unit_rate": rate,
            "total": total,
            "resource_type": p.get("resource_type") or "composite",
        })

    # Итоги
    overhead = direct_cost * doc.overhead_percent / 100
    profit = direct_cost * doc.profit_percent / 100
    contingency = direct_cost * doc.contingency_percent / 100
    subtotal = direct_cost + overhead + profit + contingency
    vat = subtotal * doc.vat_percent / 100

    doc.direct_cost = direct_cost
    doc.overhead_amount = overhead
    doc.profit_amount = profit
    doc.contingency_amount = contingency
    doc.subtotal_before_vat = subtotal
    doc.vat_amount = vat
    doc.grand_total = subtotal + vat

    # Заполним subtotal секций
    for section in doc.sections:
        positions_for_section = [p for p in doc.positions if p.section_code == section.section_code]
        section.subtotal = sum(float(p.total or 0) for p in positions_for_section)
        section.positions_count = len(positions_for_section)

    doc.insert(ignore_permissions=False)
    frappe.db.commit()

    return {
        "ok": True, "name": doc.name,
        "sections": len(doc.sections or []),
        "positions": len(doc.positions or []),
        "direct_cost": direct_cost,
        "grand_total": float(doc.grand_total or 0),
    }
