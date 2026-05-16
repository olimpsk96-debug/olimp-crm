"""Анализатор Decomposition Feedback — предлагает создать новые шаблоны.

Логика:
1. Берёт все Feedback без template_used (т.е. AI-генерация или нет шаблона)
2. Кластеризует похожие описания через rapidfuzz token_sort_ratio
3. Если кластер ≥ 3 запросов с одинаковой темой → создаёт Work Template (черновик)
   с is_verified=0, source="AI-генерация (черновик)"
4. Шаблон попадает в админку — главный инженер проверяет и ставит is_verified=1

Запуск (cron, ежедневно):
- olimp_construction.api.ai.template_suggester.suggest_templates
"""
from __future__ import annotations

import json
import re

import frappe

try:
    from rapidfuzz import fuzz
except ImportError:
    fuzz = None


def _normalize(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"\d+(?:[.,]\d+)?\s*(м[²2]|кв\.?м|м[³3]|куб\.?м|т|шт|кг)", "", s)
    return re.sub(r"\s+", " ", s).strip()


def _cluster_descriptions(rows: list[dict], threshold: int = 75) -> list[list[dict]]:
    """Группируем по похожести описания (token_sort_ratio)."""
    if not fuzz:
        return []
    clusters: list[list[dict]] = []
    for r in rows:
        desc = _normalize(r["description"])
        if not desc:
            continue
        placed = False
        for cl in clusters:
            ref = _normalize(cl[0]["description"])
            if fuzz.token_sort_ratio(desc, ref) >= threshold:
                cl.append(r)
                placed = True
                break
        if not placed:
            clusters.append([r])
    return clusters


@frappe.whitelist()
def analyze_clusters(days: int = 30, min_cluster_size: int = 3) -> dict:
    """Анализирует Feedback за период и находит кластеры запросов без шаблона.

    Возвращает список кандидатов на новые шаблоны (без сохранения).
    """
    frappe.has_permission("Decomposition Feedback", throw=True)
    if not fuzz:
        return {"ok": False, "error": "rapidfuzz не установлен"}

    rows = frappe.db.sql(
        """SELECT name, description, template_used, source, decomposition_json,
                  user_diff_json, rating
           FROM `tabDecomposition Feedback`
           WHERE feedback_date >= DATE_SUB(NOW(), INTERVAL %(d)s DAY)
             AND (template_used IS NULL OR template_used = '')
           ORDER BY feedback_date DESC
           LIMIT 1000""",
        {"d": int(days)}, as_dict=True,
    )

    clusters = _cluster_descriptions(rows)
    candidates = []
    for cl in clusters:
        if len(cl) < int(min_cluster_size):
            continue
        # Собираем общие stages из decomposition_json
        all_stages = []
        for fb in cl:
            try:
                d = json.loads(fb.get("decomposition_json") or "{}")
                all_stages.append({
                    "feedback_id": fb["name"],
                    "decomposition": d,
                    "rating": fb.get("rating") or "",
                })
            except (json.JSONDecodeError, TypeError):
                pass
        if not all_stages:
            continue

        # Берём первую декомпозицию как основу
        base = all_stages[0]["decomposition"]
        candidates.append({
            "cluster_size": len(cl),
            "sample_descriptions": [c["description"] for c in cl[:5]],
            "suggested_title": base.get("title") or cl[0]["description"][:80],
            "suggested_category": base.get("category") or "Прочее",
            "suggested_base_unit": base.get("base_unit") or "ед.",
            "stages_count": len(base.get("stages") or []),
            "feedback_ids": [c["name"] for c in cl],
        })

    candidates.sort(key=lambda x: -x["cluster_size"])
    return {"ok": True, "period_days": days, "candidates": candidates}


@frappe.whitelist()
def create_template_from_cluster(feedback_ids: list | str, title: str,
                                  category: str, base_unit: str,
                                  keywords: str = "") -> dict:
    """Создаёт черновик Work Template из feedback-кластера.

    is_verified=0 → шаблон не используется для поиска, ждёт верификации.
    """
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager", frappe.PermissionError)

    if isinstance(feedback_ids, str):
        feedback_ids = json.loads(feedback_ids)
    if not feedback_ids:
        frappe.throw("Не переданы feedback_ids")

    # Возьмём первый feedback как основу для stages
    first_fb = frappe.get_doc("Decomposition Feedback", feedback_ids[0])
    try:
        decomp = json.loads(first_fb.decomposition_json or "{}")
    except json.JSONDecodeError:
        frappe.throw("Не удалось распарсить decomposition_json первого feedback")

    base_stages = decomp.get("stages") or []
    if not base_stages:
        frappe.throw("В feedback нет stages")

    # Генерируем template_id
    safe_title = re.sub(r"[^a-z0-9_]+", "_", title.lower())
    template_id = f"ai_draft_{safe_title[:30]}"
    if frappe.db.exists("Work Template", template_id):
        template_id = f"{template_id}_{frappe.utils.now_datetime().strftime('%Y%m%d_%H%M%S')}"

    # Создаём шаблон-черновик
    doc = frappe.get_doc({
        "doctype": "Work Template",
        "template_id": template_id,
        "title": title,
        "category": category,
        "base_unit": base_unit,
        "typical_volume_min": decomp.get("volume") or 100,
        "typical_volume_max": (decomp.get("volume") or 100) * 5,
        "keywords": keywords or " ".join(decomp.get("title", "").lower().split()[:5]),
        "description": f"AI-генерация черновик. Создано из {len(feedback_ids)} похожих запросов. Требует проверки главным инженером.",
        "source": "AI-генерация (черновик)",
        "is_verified": 0,
        "stages": [
            {
                "stage_order": idx,
                "title": s.get("title") or f"Этап {idx}",
                "unit": s.get("unit") or "ед.",
                "norm_per_base_unit": s.get("qty", 1) / (decomp.get("volume") or 1) if decomp.get("volume") else 1,
                "labor_hours_per_unit": s.get("labor_hours", 0) / max(s.get("qty", 1), 0.01),
                "materials_json": json.dumps(s.get("materials") or {}, ensure_ascii=False),
                "gesn_ref": s.get("gesn_ref") or "",
                "notes": "Черновик из AI",
            }
            for idx, s in enumerate(base_stages, start=1)
        ],
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "ok": True,
        "template_id": template_id,
        "is_draft": True,
        "feedback_count": len(feedback_ids),
        "message": f"Создан черновик {template_id}. Проверь и поставь is_verified=1 в админке.",
    }


def suggest_templates() -> dict:
    """Cron-обёртка: автоматически логирует найденные кластеры.

    Сам не создаёт шаблоны (это опасно — могут получиться мусорные).
    Просто пишет в Error Log сводку «есть N кластеров для проверки».
    """
    try:
        result = analyze_clusters(days=14, min_cluster_size=3)
        n = len(result.get("candidates") or [])
        if n > 0:
            frappe.logger().info(
                f"Template Suggester: найдено {n} кластеров запросов без шаблона. "
                f"Создай вручную через create_template_from_cluster или в админке."
            )
    except Exception as e:
        frappe.logger().error(f"Template Suggester failed: {e}")
    return {"ok": True}
