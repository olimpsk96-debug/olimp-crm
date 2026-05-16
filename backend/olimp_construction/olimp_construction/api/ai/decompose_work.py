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


# ───────────────────────────────────────────────────────────────────────────────
# Modular Chain-of-Thought — 3 шага вместо одного. Снижает галлюцинации в 3-5×.
# Источник: preprints.org Oct 2025, "Modular CoT for Construction Cost Estimation"
# ───────────────────────────────────────────────────────────────────────────────

COT_CLASSIFY = """Определи тип строительной работы по описанию.
ВЕРНИ JSON: {"work_type": "<АКЗ|Огнезащита|Усиление конструкций|Монтаж м/к|Промальп|Кровля|Полы|Бетонные работы|Демонтаж|Прочее>", "base_unit": "<м²|м³|т|шт|пог.м>", "confidence": <0..1>}"""

COT_EXTRACT = """Извлеки параметры работы из описания.
ВЕРНИ JSON: {"volume": <число или null>, "material": "<главный материал>", "surface_state": "<новая|старая ржавая|бетон|...>", "special_requirements": "<R90|химстойкость|... или пусто>", "constraints": "<высотные|действующее производство|пусто>"}"""

COT_DECOMPOSE = """Ты — главный инженер ПТО ООО «Олимп» (Екатеринбург, промышленное строительство).
Профиль: АКЗ, огнезащита, усиление конструкций (CFRP/металл), монтаж м/к, промальп, кровли, полы.

Контекст работы:
- Тип: {work_type}
- Базовая единица: {base_unit}
- Объём: {volume} {base_unit}
- Материал: {material}
- Поверхность: {surface_state}
- Требования: {special_requirements}
- Ограничения: {constraints}

Разбей работу на технологические этапы. Минимум 4 этапа: подготовка → основа → отделка → контроль.
ВЕРНИ СТРОГО JSON:
{{
  "title": "<нормализованное название>",
  "stages": [
    {{"title": "<этап>", "unit": "<м²|м³|кг|шт|чел.-час>", "norm_per_base_unit": <float>,
      "labor_hours_per_unit": <float>, "materials": {{"<key>": <float>}}, "gesn_ref": ""}}
  ],
  "warnings": "<2-3 риска или замечания директору>"
}}

Правила:
- АКЗ/огнезащита: ПЕРВЫЙ этап — подготовка поверхности (пескоструй/зачистка).
- Усиление CFRP: подготовка → грунт → раскрой ткани → смола (1) → укладка → пропитка (2) → контроль.
- Не выдумывай шифры ГЭСН — лучше пустая строка, чем неверный шифр.
- Нормы труда — консервативные (с запасом 15-20%)."""

# Legacy single-prompt — используется если выключен CoT (флаг use_cot=0)
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
    """Ищем Work Template, который лучше всего описывает работу.

    Стратегия:
    1. Сначала — семантический поиск через Qdrant (если индекс есть и есть OPENAI_API_KEY)
    2. Fallback — keyword-match по списку шаблонов

    Возвращает {template_name, score, source} или None.
    """
    # 1) Семантический поиск
    try:
        from olimp_construction.api.ai.work_templates_index import search as semantic_search
        hits = semantic_search(description, limit=1)
        if hits and hits[0].get("score", 0) >= 0.45:
            tpl_id = hits[0]["template_id"]
            full = frappe.get_value(
                "Work Template", tpl_id,
                ["name", "title", "category", "base_unit", "keywords"],
                as_dict=True,
            )
            if full:
                return {"template": full, "score": hits[0]["score"], "source": "semantic"}
    except Exception as e:
        # Любая проблема (нет ключа OpenAI, нет коллекции в Qdrant) → fallback на keyword
        frappe.logger().debug(f"Semantic search не сработал: {e}")

    # 2) Keyword fallback
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
        kw_tokens = set(tok.replace(",", "") for tok in kw_text.split())
        title_tokens = set(_normalize(t.get("title") or "").split())
        all_tokens = kw_tokens | title_tokens

        overlap = len(desc_tokens & all_tokens)
        if overlap > best_score:
            best_score = overlap
            best = t

    if best and best_score >= 2:
        return {"template": best, "score": best_score, "source": "keyword"}
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

            # Если этап привязан к Catalog Resource — подтягиваем цену
            unit_price = 0.0
            catalog_resource_name = None
            if s.catalog_resource:
                row = frappe.db.get_value(
                    "Catalog Resource", s.catalog_resource,
                    ["name", "price_avg"], as_dict=True,
                )
                if row:
                    unit_price = flt(row.get("price_avg") or 0)
                    catalog_resource_name = row.get("name")

            stages.append({
                "title": s.title,
                "unit": s.unit or "ед.",
                "qty": round(qty, 3),
                "labor_hours": round(labor, 2),
                "materials": materials,
                "gesn_ref": s.gesn_ref or "",
                "notes": s.notes or "",
                "catalog_resource": catalog_resource_name,
                "unit_price": round(unit_price, 2),
                "amount": round(unit_price * qty, 2) if unit_price else 0.0,
            })

        result["source"] = "template"
        result["template_match_method"] = match.get("source", "keyword")  # semantic | keyword
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
        # Шаблона нет — просим Claude через Modular CoT (3 шага)
        decomp = _ai_decompose_cot(description, final_volume, final_unit)
        result["source"] = "ai"
        result["ai_method"] = "modular_cot"
        result["decomposition"] = decomp

    # 3) Если задан estimate_name — добавляем строки в смету
    if estimate_name:
        added = _apply_to_estimate(estimate_name, result["decomposition"])
        result["estimate_items_added"] = added

    # 4) Сохраняем feedback (для обучения и аналитики)
    try:
        feedback_doc = frappe.get_doc({
            "doctype": "Decomposition Feedback",
            "description": description[:140],
            "template_used": result.get("template_name"),
            "source": _source_label(result),
            "estimate": estimate_name,
            "user_email": frappe.session.user,
            "was_applied": 1 if estimate_name else 0,
            "decomposition_json": json.dumps(result.get("decomposition") or {}, ensure_ascii=False)[:50000],
        })
        feedback_doc.insert(ignore_permissions=True)
        result["feedback_id"] = feedback_doc.name
    except Exception as e:
        frappe.logger().warning(f"Не удалось сохранить Decomposition Feedback: {e}")

    return result


def _source_label(result: dict) -> str:
    src = result.get("source")
    method = result.get("template_match_method") or result.get("ai_method")
    if src == "template":
        return "Шаблон (semantic)" if method == "semantic" else "Шаблон (keyword)"
    if src == "ai":
        return "AI (CoT)" if method == "modular_cot" else "AI (single-prompt)"
    return src or "—"


@frappe.whitelist()
def rate_feedback(feedback_id: str, rating: str | None = None,
                  comment: str | None = None, was_edited: int | bool = 0) -> dict:
    """Сохранить оценку пользователя по декомпозиции.

    Вызывается из UI после того, как пользователь:
    - оценил полезность (rating)
    - оставил комментарий
    - редактировал ли строки после применения
    """
    if not frappe.db.exists("Decomposition Feedback", feedback_id):
        frappe.throw(_("Feedback {} не найден").format(feedback_id))

    doc = frappe.get_doc("Decomposition Feedback", feedback_id)
    if rating:
        doc.rating = rating
    if comment:
        doc.user_comment = comment[:1000]
    doc.was_edited_after = 1 if int(was_edited or 0) else 0
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "feedback_id": feedback_id}


@frappe.whitelist()
def get_feedback_stats(days: int = 30) -> dict:
    """Статистика обратной связи за период."""
    frappe.has_permission("Decomposition Feedback", throw=True)
    days = max(1, min(int(days), 365))
    row = frappe.db.sql(
        """SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN source LIKE 'Шаблон%%' THEN 1 ELSE 0 END) AS from_template,
              SUM(CASE WHEN source LIKE 'AI%%' THEN 1 ELSE 0 END) AS from_ai,
              SUM(CASE WHEN was_applied=1 THEN 1 ELSE 0 END) AS applied,
              SUM(CASE WHEN was_edited_after=1 THEN 1 ELSE 0 END) AS edited,
              SUM(CASE WHEN rating LIKE '%%Полезно%%' THEN 1 ELSE 0 END) AS rated_good,
              SUM(CASE WHEN rating LIKE '%%Бесполезно%%' THEN 1 ELSE 0 END) AS rated_bad
           FROM `tabDecomposition Feedback`
           WHERE feedback_date >= DATE_SUB(NOW(), INTERVAL %(d)s DAY)""",
        {"d": days}, as_dict=True,
    )[0]
    return {k: int(row.get(k) or 0) for k in row}


# ───────────────────────────────────────────────────────────────────────────────
# Modular Chain-of-Thought — 3 шага вместо одного промпта
# ───────────────────────────────────────────────────────────────────────────────

def _claude_json(client, prompt: str, user_msg: str, max_tokens: int = 1024) -> dict:
    """Запрос к Claude с гарантированным JSON-ответом (снимает code fences)."""
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=max_tokens,
        system=prompt,
        messages=[{"role": "user", "content": user_msg}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        frappe.throw(_("Claude вернул не-JSON: {}").format(str(e)[:200]))
        return {}


def _ai_decompose_cot(description: str, volume: float, unit: str | None) -> dict:
    """Полный CoT-pipeline: classify → extract → decompose.

    Каждый шаг — отдельный вызов Claude с узкой задачей. Это резко снижает
    галлюцинации (preprints.org Oct 2025: в 3-5×) по сравнению с single-prompt.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        frappe.throw(_(
            "Шаблон для этой работы не найден. "
            "Для AI-генерации нужен ANTHROPIC_API_KEY в .env. "
            "Альтернатива: создай Work Template вручную в админке."
        ))

    try:
        import anthropic
    except ImportError:
        frappe.throw(_("Пакет anthropic не установлен"))

    client = anthropic.Anthropic(api_key=api_key)

    # Шаг 1: классификация
    step1 = _claude_json(client, COT_CLASSIFY, f"Описание: {description}", max_tokens=256)
    work_type = step1.get("work_type") or "Прочее"
    base_unit = step1.get("base_unit") or unit or "ед."

    # Шаг 2: параметры
    step2 = _claude_json(client, COT_EXTRACT, f"Описание: {description}", max_tokens=384)
    vol = flt(step2.get("volume") or volume or 100)
    params = {
        "work_type": work_type,
        "base_unit": base_unit,
        "volume": vol,
        "material": step2.get("material") or "",
        "surface_state": step2.get("surface_state") or "",
        "special_requirements": step2.get("special_requirements") or "",
        "constraints": step2.get("constraints") or "",
    }

    # Шаг 3: декомпозиция с полным контекстом
    step3 = _claude_json(client, COT_DECOMPOSE.format(**params), description, max_tokens=2048)

    # Нормализуем формат
    stages = []
    for s in step3.get("stages") or []:
        qty = flt(s.get("norm_per_base_unit") or 1) * vol
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

    return {
        "title": step3.get("title") or description.strip()[:60],
        "category": work_type,
        "base_unit": base_unit,
        "volume": vol,
        "stages": stages,
        "warnings": step3.get("warnings") or "",
        "cot_params": params,  # для отладки/UI
    }


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

        unit_price = flt(stage.get("unit_price") or 0)
        est.append("items", {
            "item_code": (stage.get("gesn_ref") or "")[:40] or f"WT-S{count}",
            "item_name": stage.get("title") or f"Этап {count}",
            "unit": stage.get("unit") or "ед.",
            "qty": flt(stage.get("qty") or 0),
            "base_unit_price": unit_price,
            "our_unit_price": unit_price * 1.15 if unit_price else 0,  # 15% наценка по умолчанию
            "notes": notes_combined[:500] if notes_combined else None,
        })
        count += 1

    est.save(ignore_permissions=True)
    frappe.db.commit()
    return count - 1
