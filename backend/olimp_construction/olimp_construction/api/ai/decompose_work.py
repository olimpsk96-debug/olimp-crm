"""AI-декомпозиция работы на этапы.

Пользователь пишет: «усиление плиты углеволокном, 120 м²»
Возвращается список этапов с объёмами, нормами труда, материалами.

Pipeline (single-prompt MVP):
1. Поиск похожего Work Template (keywords match + fuzzy)
2. Если нашли — берём stages из него и масштабируем по объёму
3. Если нет — просим Claude сгенерировать с нуля (помечается is_verified=0)
"""
from __future__ import annotations

import os
import json
import re

import frappe
from frappe import _
from frappe.utils import flt


SYSTEM_PROMPT = """Ты — главный инженер ПТО строительной компании «Олимп» (Екатеринбург).
Профиль компании: АКЗ резервуаров, огнезащита м/к, усиление конструкций (CFRP/металл),
монтаж м/к, промышленный альпинизм, кровли, полы.

Тебе дают краткое описание работы и объём. Разбей работу на технологические этапы
(подготовка → основные работы → контроль/сдача). Для каждого этапа укажи:
- название (что делают)
- единица измерения (м², м³, кг, т, шт, чел.-час)
- норма на единицу базового объёма работы (множитель)
- норма труда (чел.-час на единицу этапа)
- материалы (краткий JSON: {"primer_kg": 0.3, "abrasive_kg": 35})
- ГЭСН/ФЕР-шифр если уверен (иначе пусто)

ВЕРНИ СТРОГО JSON (без markdown, без комментариев):
{
  "title": "<нормализованное название работы>",
  "category": "<АКЗ|Огнезащита|Усиление конструкций|Монтаж м/к|Промальп|Кровля|Полы|Бетонные работы|Демонтаж|Прочее>",
  "base_unit": "<м²|м³|т|шт>",
  "volume": <число — объём работы>,
  "stages": [
    {
      "title": "<этап>",
      "unit": "<ед.>",
      "norm_per_base_unit": <float>,
      "labor_hours_per_unit": <float>,
      "materials": {"<material_key>": <kg_per_unit>},
      "gesn_ref": "<шифр или пусто>"
    }
  ],
  "warnings": "<2-3 риска или замечания которые директор должен знать>"
}

Правила:
- Если не уверен в норме — ставь консервативную оценку (выше).
- Контроль качества — отдельный этап в конце.
- Подготовка поверхности (пескоструй/обеспыливание) — всегда первый этап для АКЗ/огнезащиты.
- Для усиления CFRP — обязательно: подготовка → грунтование → раскрой ткани → нанесение смолы → укладка → пропитка → финиш.
- Не выдумывай несуществующие шифры ГЭСН — лучше пусто, чем неверно."""


# ───────────────────────────────────────────────────────────────────────────────
# Поиск шаблона
# ───────────────────────────────────────────────────────────────────────────────

def _normalize(s: str) -> str:
    """Приводит к нижнему регистру + убирает пунктуацию для match."""
    return re.sub(r"[^\w\s]", " ", (s or "").lower())


def _find_matching_template(description: str) -> dict | None:
    """Ищем Work Template с максимальным пересечением keywords.

    Простой keyword-match (без эмбеддингов на этом этапе MVP).
    Возвращает {template_name, score} или None.
    """
    desc_norm = _normalize(description)
    desc_tokens = set(desc_norm.split())

    templates = frappe.get_all(
        "Work Template",
        filters={"is_verified": 1},
        fields=["name", "title", "category", "base_unit", "keywords"],
    )

    best = None
    best_score = 0
    for t in templates:
        kw_text = _normalize(t.get("keywords") or "")
        kw_tokens = set(t.replace(",", " ") for t in kw_text.split())
        # Также добавим слова из title
        title_tokens = set(_normalize(t.get("title") or "").split())
        all_tokens = kw_tokens | title_tokens

        overlap = len(desc_tokens & all_tokens)
        if overlap > best_score:
            best_score = overlap
            best = t

    if best and best_score >= 2:
        return {"template": best, "score": best_score}
    return None


# ───────────────────────────────────────────────────────────────────────────────
# Извлечение объёма из текста
# ───────────────────────────────────────────────────────────────────────────────

_VOLUME_RE = re.compile(
    r"(?P<num>\d+(?:[.,]\d+)?)\s*(?P<unit>м[²2]|кв\.?м|м[³3]|куб\.?м|т|тонн|шт|кг|кв|куб)",
    re.IGNORECASE,
)

_UNIT_MAP = {
    "м2": "м²", "м²": "м²", "кв.м": "м²", "квм": "м²", "кв": "м²",
    "м3": "м³", "м³": "м³", "куб.м": "м³", "кубм": "м³", "куб": "м³",
    "т": "т", "тонн": "т",
    "шт": "шт",
    "кг": "кг",
}


def _extract_volume(text: str) -> tuple[float | None, str | None]:
    """Извлекает объём и единицу: "120 м²" → (120, "м²")."""
    if not text:
        return None, None
    m = _VOLUME_RE.search(text)
    if not m:
        return None, None
    num = float(m.group("num").replace(",", "."))
    unit_raw = m.group("unit").lower().replace(".", "").replace(" ", "")
    unit = _UNIT_MAP.get(unit_raw, unit_raw)
    return num, unit


# ───────────────────────────────────────────────────────────────────────────────
# Главный endpoint
# ───────────────────────────────────────────────────────────────────────────────

@frappe.whitelist()
def decompose_work(description: str, volume: float | str | None = None,
                   estimate_name: str | None = None) -> dict:
    """Разбивает описание работы на этапы.

    Параметры:
    - description: "усиление плиты углеволокном, 120 м²"
    - volume: явный объём (если не указан в description)
    - estimate_name: если задан, добавим строки в существующую смету

    Возвращает:
    {
      ok: true,
      source: "template" | "ai" | "ai_fallback",
      template_name: <если из шаблона>,
      decomposition: {
        title, category, base_unit, volume,
        stages: [{title, unit, qty, labor_hours, materials, gesn_ref}]
      },
      estimate_items_added: <если estimate_name был задан>
    }
    """
    frappe.has_permission("Work Template", throw=True)
    if not description or len(description.strip()) < 5:
        frappe.throw(_("Опиши работу хотя бы парой слов"))

    # 1) Извлекаем объём
    extracted_volume, extracted_unit = _extract_volume(description)
    final_volume = flt(volume) if volume else (extracted_volume or 0)
    final_unit = extracted_unit

    # 2) Ищем шаблон
    match = _find_matching_template(description)

    result: dict = {"ok": True}

    if match:
        # Используем готовый шаблон
        tpl = frappe.get_doc("Work Template", match["template"]["name"])
        base_unit = tpl.base_unit
        if not final_volume:
            final_volume = flt(tpl.typical_volume_min) or 100
            final_unit = base_unit

        stages = []
        for s in (tpl.stages or []):
            qty = flt(s.norm_per_base_unit or 1) * final_volume
            labor = flt(s.labor_hours_per_unit or 0) * qty
            materials = {}
            if s.materials_json:
                try:
                    norms = json.loads(s.materials_json)
                    materials = {k: round(v * qty, 3) for k, v in norms.items()}
                except (json.JSONDecodeError, TypeError):
                    pass

            stages.append({
                "title": s.title,
                "unit": s.unit or "ед.",
                "qty": round(qty, 3),
                "labor_hours": round(labor, 2),
                "materials": materials,
                "gesn_ref": s.gesn_ref or "",
                "notes": s.notes or "",
            })

        result["source"] = "template"
        result["template_name"] = tpl.name
        result["template_match_score"] = match["score"]
        result["decomposition"] = {
            "title": tpl.title,
            "category": tpl.category,
            "base_unit": base_unit,
            "volume": final_volume,
            "stages": stages,
            "warnings": "",
        }
        tpl.increment_usage()

    else:
        # Шаблона нет — просим Claude (если ключ есть)
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            frappe.throw(_(
                "Шаблон для этой работы не найден. "
                "Для AI-генерации нужен ANTHROPIC_API_KEY в .env. "
                "Альтернатива: создай Work Template вручную (страница Work Template в админке)."
            ))

        try:
            import anthropic
        except ImportError:
            frappe.throw(_("Пакет anthropic не установлен"))

        client = anthropic.Anthropic(api_key=api_key)

        user_msg = f"Работа: {description}\n"
        if final_volume:
            user_msg += f"Объём: {final_volume} {final_unit or ''}\n"

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = message.content[0].text.strip()
        # Снимаем possible code fences
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            frappe.throw(_("Claude вернул не-JSON: {}").format(str(e)[:200]))

        # Нормализуем формат как у шаблонной ветки
        ai_volume = flt(data.get("volume") or final_volume or 100)
        stages = []
        for s in data.get("stages") or []:
            qty = flt(s.get("norm_per_base_unit") or 1) * ai_volume
            labor = flt(s.get("labor_hours_per_unit") or 0) * qty
            mat_norms = s.get("materials") or {}
            materials = {k: round(flt(v) * qty, 3) for k, v in mat_norms.items()} if isinstance(mat_norms, dict) else {}
            stages.append({
                "title": s.get("title") or "Этап",
                "unit": s.get("unit") or "ед.",
                "qty": round(qty, 3),
                "labor_hours": round(labor, 2),
                "materials": materials,
                "gesn_ref": s.get("gesn_ref") or "",
                "notes": "",
            })

        result["source"] = "ai"
        result["decomposition"] = {
            "title": data.get("title") or description.strip()[:60],
            "category": data.get("category") or "Прочее",
            "base_unit": data.get("base_unit") or final_unit or "ед.",
            "volume": ai_volume,
            "stages": stages,
            "warnings": data.get("warnings") or "",
        }

    # 3) Если задан estimate_name — добавляем строки в смету
    if estimate_name:
        added = _apply_to_estimate(estimate_name, result["decomposition"])
        result["estimate_items_added"] = added

    return result


def _apply_to_estimate(estimate_name: str, decomp: dict) -> int:
    """Добавляет этапы декомпозиции как строки в существующую смету."""
    frappe.has_permission("Estimate", "write", doc=estimate_name, throw=True)
    est = frappe.get_doc("Estimate", estimate_name)

    # Раздел-заголовок
    est.append("items", {
        "item_code": f"WT-{decomp.get('title','')[:50]}",
        "item_name": decomp.get("title") or "Декомпозиция",
        "is_section": 1,
        "unit": "",
        "qty": 0,
        "base_unit_price": 0,
        "our_unit_price": 0,
    })

    count = 1
    for stage in decomp.get("stages") or []:
        materials = stage.get("materials") or {}
        mat_note = ", ".join(f"{k}: {v}" for k, v in materials.items())
        notes_combined = stage.get("notes") or ""
        if mat_note:
            notes_combined = (notes_combined + " | " if notes_combined else "") + mat_note

        est.append("items", {
            "item_code": (stage.get("gesn_ref") or "")[:40] or f"WT-S{count}",
            "item_name": stage.get("title") or f"Этап {count}",
            "unit": stage.get("unit") or "ед.",
            "qty": flt(stage.get("qty") or 0),
            "base_unit_price": 0,
            "our_unit_price": 0,
            "notes": notes_combined[:500] if notes_combined else None,
        })
        count += 1

    est.save(ignore_permissions=True)
    frappe.db.commit()
    return count - 1
