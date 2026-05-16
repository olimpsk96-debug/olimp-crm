"""API для Inspection Template + Inspection Run.

Идея: iAuditor / SafetyCulture — структурированные чек-листы с conditional logic,
score / pass-fail, photos. Для строительства актуально для:
- Входной контроль материалов (приёмка от поставщика)
- Приёмка скрытых работ (армирование, гидроизоляция)
- ОТ/ТБ обход (СИЗ, ограждения, наряды-допуски)
"""
from __future__ import annotations

import json

import frappe


# ── Seed templates (3 готовых из коробки) ────────────────────────────────────

SEED_TEMPLATES = [
    {
        "template_id": "input_control_metal",
        "title": "Входной контроль металлопроката",
        "category": "Входной контроль",
        "description": "Приёмка металлопроката (балки, листы, профили, арматура) от поставщика. Заполняется при разгрузке.",
        "questions": [
            {"id": "q1", "text": "Сертификат качества предоставлен?", "kind": "yesno", "weight": 2, "critical": True},
            {"id": "q2", "text": "Маркировка соответствует накладной?", "kind": "yesno", "weight": 1, "critical": True},
            {"id": "q3", "text": "Количество соответствует УПД?", "kind": "yesno", "weight": 2, "critical": True},
            {"id": "q4", "text": "Внешний вид (коррозия, искривление)?", "kind": "score", "weight": 1},
            {"id": "q5", "text": "Геометрия (длина/толщина) в допусках?", "kind": "yesno", "weight": 1},
            {"id": "q6", "text": "Фото партии при приёмке", "kind": "photo", "weight": 1},
            {"id": "q7", "text": "Дефекты / замечания (опишите)", "kind": "text", "weight": 0},
        ],
    },
    {
        "template_id": "hidden_works_rebar",
        "title": "Приёмка скрытых работ: армирование",
        "category": "Приёмка скрытых работ",
        "description": "Освидетельствование армирования ж/б конструкции перед бетонированием. По ВСН 12-87.",
        "questions": [
            {"id": "q1", "text": "Сертификаты на арматуру предоставлены?", "kind": "yesno", "weight": 2, "critical": True},
            {"id": "q2", "text": "Диаметр и класс соответствуют проекту?", "kind": "yesno", "weight": 2, "critical": True},
            {"id": "q3", "text": "Шаг арматуры выдержан (по проекту)?", "kind": "yesno", "weight": 2, "critical": True},
            {"id": "q4", "text": "Защитный слой бетона обеспечен (фиксаторы)?", "kind": "yesno", "weight": 1, "critical": True},
            {"id": "q5", "text": "Стыки арматуры по длине и месту?", "kind": "yesno", "weight": 1},
            {"id": "q6", "text": "Вязка / сварка надёжна?", "kind": "score", "weight": 1},
            {"id": "q7", "text": "Опалубка очищена и смазана?", "kind": "yesno", "weight": 1},
            {"id": "q8", "text": "Фото армирования (общий вид + крупный план)", "kind": "photo", "weight": 1},
            {"id": "q9", "text": "Замечания", "kind": "text", "weight": 0},
        ],
    },
    {
        "template_id": "safety_walkaround_daily",
        "title": "ОТ/ТБ — ежедневный обход",
        "category": "ОТ/ТБ обход",
        "description": "Утренний обход прорабом перед началом работ. По положению о ВВР.",
        "questions": [
            {"id": "q1", "text": "Бригада прошла инструктаж сегодня?", "kind": "yesno", "weight": 2, "critical": True},
            {"id": "q2", "text": "Все рабочие в СИЗ (каски, обувь, очки)?", "kind": "yesno", "weight": 2, "critical": True},
            {"id": "q3", "text": "Ограждения опасных зон установлены?", "kind": "yesno", "weight": 2, "critical": True},
            {"id": "q4", "text": "Леса/подмости проверены / приняты?", "kind": "yesno", "weight": 1, "critical": True},
            {"id": "q5", "text": "Огневые работы — наряд-допуск?", "kind": "yesno", "weight": 2},
            {"id": "q6", "text": "Электробезопасность (заземление, изоляция)?", "kind": "score", "weight": 1},
            {"id": "q7", "text": "Аптечка / огнетушитель в наличии?", "kind": "yesno", "weight": 1},
            {"id": "q8", "text": "Порядок на рабочем месте", "kind": "score", "weight": 1},
            {"id": "q9", "text": "Замечания / нарушения", "kind": "text", "weight": 0},
            {"id": "q10", "text": "Фото нарушения (если есть)", "kind": "photo", "weight": 0},
        ],
    },
]


@frappe.whitelist()
def seed_templates(force: int = 0) -> dict:
    """Создаёт 3 базовых шаблона инспекций."""
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager", frappe.PermissionError)

    created = updated = skipped = 0
    for tpl in SEED_TEMPLATES:
        tid = tpl["template_id"]
        if frappe.db.exists("Inspection Template", tid):
            if int(force or 0):
                frappe.delete_doc("Inspection Template", tid, force=True, ignore_permissions=True)
                updated += 1
            else:
                skipped += 1
                continue

        doc = frappe.get_doc({
            "doctype": "Inspection Template",
            "template_id": tid,
            "title": tpl["title"],
            "category": tpl["category"],
            "description": tpl["description"],
            "is_active": 1,
            "questions_json": json.dumps(tpl["questions"], ensure_ascii=False),
        })
        doc.insert(ignore_permissions=True)
        created += 1

    frappe.db.commit()
    return {"ok": True, "created": created, "updated": updated, "skipped": skipped}


# ── List / detail / run ──────────────────────────────────────────────────────

@frappe.whitelist()
def get_templates(category: str | None = None, active_only: int = 1) -> list[dict]:
    frappe.has_permission("Inspection Template", throw=True)
    filters: dict = {}
    if category:
        filters["category"] = category
    if int(active_only):
        filters["is_active"] = 1

    rows = frappe.get_all(
        "Inspection Template",
        filters=filters,
        fields=["name", "template_id", "title", "category", "is_active",
                "usage_count", "description"],
        order_by="usage_count DESC, modified DESC",
    )
    # Кол-во вопросов
    for r in rows:
        try:
            qs = json.loads(frappe.db.get_value("Inspection Template", r["name"], "questions_json") or "[]")
            r["question_count"] = len(qs)
        except (json.JSONDecodeError, TypeError):
            r["question_count"] = 0
    return rows


@frappe.whitelist()
def get_template_detail(name: str) -> dict:
    frappe.has_permission("Inspection Template", "read", doc=name, throw=True)
    doc = frappe.get_doc("Inspection Template", name)
    out = doc.as_dict()
    try:
        out["questions"] = json.loads(doc.questions_json or "[]")
    except json.JSONDecodeError:
        out["questions"] = []
    return out


@frappe.whitelist()
def start_inspection(template: str, project: str | None = None,
                     inspector_name: str | None = None, title: str | None = None) -> dict:
    """Запустить проверку — создать Inspection Run в статусе «В работе»."""
    frappe.has_permission("Inspection Run", "create", throw=True)
    if not frappe.db.exists("Inspection Template", template):
        frappe.throw(f"Шаблон {template} не найден")

    tpl_title = frappe.db.get_value("Inspection Template", template, "title")

    doc = frappe.get_doc({
        "doctype": "Inspection Run",
        "title": title or f"{tpl_title} — {frappe.utils.now_datetime().strftime('%d.%m.%Y')}",
        "template": template,
        "project": project,
        "inspector_name": inspector_name or frappe.session.user,
        "status": "В работе",
        "answers_json": "[]",
    })
    doc.insert(ignore_permissions=True)

    # Инкремент usage
    cur = frappe.db.get_value("Inspection Template", template, "usage_count") or 0
    frappe.db.set_value("Inspection Template", template, "usage_count", cur + 1, update_modified=False)
    frappe.db.commit()

    return {"ok": True, "run_id": doc.name}


@frappe.whitelist()
def submit_answers(run_id: str, answers: list | str, finish: int = 1,
                   notes: str | None = None) -> dict:
    """Сохранить ответы. Если finish=1 — закрываем проверку."""
    frappe.has_permission("Inspection Run", "write", doc=run_id, throw=True)
    if isinstance(answers, str):
        answers = json.loads(answers)

    doc = frappe.get_doc("Inspection Run", run_id)
    doc.answers_json = json.dumps(answers, ensure_ascii=False)
    if notes is not None:
        doc.notes = notes[:2000]
    if int(finish or 0):
        doc.finished_at = frappe.utils.now_datetime()
        # status подставится в before_save (Pass / Fail)
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "ok": True,
        "run_id": run_id,
        "score_pct": doc.score_pct,
        "critical_fails": doc.critical_fails,
        "status": doc.status,
    }


@frappe.whitelist()
def get_runs(project: str | None = None, days: int = 30) -> list[dict]:
    frappe.has_permission("Inspection Run", throw=True)
    filters_sql = "WHERE started_at >= DATE_SUB(NOW(), INTERVAL %(d)s DAY)"
    params: dict = {"d": int(days)}
    if project:
        filters_sql += " AND project = %(p)s"
        params["p"] = project

    return frappe.db.sql(
        f"""SELECT name, title, template, project, inspector_name,
                   started_at, finished_at, status, score_pct, critical_fails
            FROM `tabInspection Run`
            {filters_sql}
            ORDER BY started_at DESC
            LIMIT 100""",
        params, as_dict=True,
    )
