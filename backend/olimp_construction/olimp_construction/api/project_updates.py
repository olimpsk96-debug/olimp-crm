"""API для еженедельных Project Health Updates (Linear-style).

Идея: каждую неделю руководитель проекта (или прораб) пишет короткий апдейт:
- 🟢/🟡/🔴 светофор здоровья
- что сделано
- блокеры
- план на след неделю

Директор видит ленту + heatmap портфеля.
"""
from __future__ import annotations

from datetime import timedelta

import frappe
from frappe.utils import add_days, getdate, nowdate


HEALTH_VALUES = ["🟢 Зелёный", "🟡 Жёлтый", "🔴 Красный"]


def _monday_of(date_str: str | None = None) -> str:
    """Возвращает понедельник недели для указанной даты (YYYY-MM-DD)."""
    d = getdate(date_str) if date_str else getdate(nowdate())
    monday = d - timedelta(days=d.weekday())
    return monday.strftime("%Y-%m-%d")


@frappe.whitelist()
def get_updates(project: str | None = None, weeks: int = 12) -> list[dict]:
    """Лента апдейтов: для одного проекта или для всего портфеля."""
    frappe.has_permission("Construction Project Update", throw=True)
    filters: dict = {
        "week_start": [">=", add_days(nowdate(), -7 * int(weeks))],
    }
    if project:
        filters["project"] = project

    rows = frappe.get_all(
        "Construction Project Update",
        filters=filters,
        fields=["name", "project", "week_start", "health", "author",
                "summary", "blockers", "next_week_plan",
                "cpi_snapshot", "spi_snapshot", "ai_drafted",
                "modified", "owner"],
        order_by="week_start DESC, modified DESC",
        limit_page_length=200,
    )
    # Добавим title проекта
    for r in rows:
        r["project_title"] = frappe.db.get_value("Construction Project", r["project"], "title") or r["project"]
    return rows


@frappe.whitelist()
def save_update(name: str | None = None, project: str = "", week_start: str | None = None,
                health: str = "🟢 Зелёный", summary: str = "", blockers: str = "",
                next_week_plan: str = "", ai_drafted: int = 0, ai_model: str = "") -> dict:
    """Создать или обновить апдейт."""
    if not project:
        frappe.throw("project обязателен")
    if not summary or not summary.strip():
        frappe.throw("summary обязателен")
    if health not in HEALTH_VALUES:
        frappe.throw(f"health должен быть одним из: {HEALTH_VALUES}")

    week = _monday_of(week_start)

    # Один апдейт на (project, week_start) — поведение upsert
    existing_name = name or frappe.db.get_value(
        "Construction Project Update", {"project": project, "week_start": week}, "name"
    )

    if existing_name:
        frappe.has_permission("Construction Project Update", "write", doc=existing_name, throw=True)
        doc = frappe.get_doc("Construction Project Update", existing_name)
        action = "updated"
    else:
        frappe.has_permission("Construction Project Update", "create", throw=True)
        doc = frappe.new_doc("Construction Project Update")
        doc.project = project
        doc.week_start = week
        action = "created"

    doc.health = health
    doc.summary = summary.strip()[:5000]
    doc.blockers = (blockers or "").strip()[:3000]
    doc.next_week_plan = (next_week_plan or "").strip()[:3000]
    doc.ai_drafted = int(ai_drafted or 0)
    doc.ai_model = ai_model or ""
    doc.author = doc.author or frappe.session.user

    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name, "action": action}


@frappe.whitelist()
def delete_update(name: str) -> dict:
    frappe.has_permission("Construction Project Update", "delete", doc=name, throw=True)
    frappe.delete_doc("Construction Project Update", name, ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist()
def get_portfolio_health(weeks: int = 4) -> dict:
    """Здоровье портфеля: для каждого активного проекта — последний апдейт + динамика."""
    frappe.has_permission("Construction Project", throw=True)
    frappe.has_permission("Construction Project Update", throw=True)

    projects = frappe.get_all(
        "Construction Project",
        filters={"status": ["not in", ["Завершён", "Архивирован"]]},
        fields=["name", "title", "status"],
        order_by="modified DESC",
        limit_page_length=100,
    )

    out = []
    for p in projects:
        # Последний апдейт
        last = frappe.db.sql("""
            SELECT name, week_start, health, summary
            FROM `tabConstruction Project Update`
            WHERE project = %(p)s
            ORDER BY week_start DESC, modified DESC
            LIMIT 1
        """, {"p": p["name"]}, as_dict=True)

        latest = last[0] if last else None

        # Сколько апдейтов за период
        cnt = frappe.db.count(
            "Construction Project Update",
            filters={
                "project": p["name"],
                "week_start": [">=", add_days(nowdate(), -7 * int(weeks))],
            },
        )

        # Историческая последовательность health
        history = frappe.db.sql("""
            SELECT week_start, health
            FROM `tabConstruction Project Update`
            WHERE project = %(p)s AND week_start >= %(start)s
            ORDER BY week_start ASC
        """, {
            "p": p["name"],
            "start": add_days(nowdate(), -7 * int(weeks)),
        }, as_dict=True)

        # Stale: нет апдейта в текущую неделю
        this_week = _monday_of()
        is_stale = not latest or str(latest["week_start"]) < this_week

        out.append({
            "project": p["name"],
            "project_title": p.get("title") or p["name"],
            "status": p["status"],
            "latest_health": latest["health"] if latest else None,
            "latest_week": str(latest["week_start"]) if latest else None,
            "latest_summary": (latest["summary"] or "")[:200] if latest else "",
            "updates_count": cnt,
            "history": [{"week": str(h["week_start"]), "health": h["health"]} for h in history],
            "is_stale": is_stale,
        })

    # Сортировка: красные сверху, потом жёлтые, потом stale, потом зелёные
    def sort_key(p):
        h = p["latest_health"] or ""
        if "🔴" in h:
            return (0, p["project"])
        if "🟡" in h:
            return (1, p["project"])
        if p["is_stale"]:
            return (2, p["project"])
        return (3, p["project"])
    out.sort(key=sort_key)

    # Сводка
    summary = {
        "total": len(out),
        "red": sum(1 for p in out if "🔴" in (p["latest_health"] or "")),
        "yellow": sum(1 for p in out if "🟡" in (p["latest_health"] or "")),
        "green": sum(1 for p in out if "🟢" in (p["latest_health"] or "")),
        "no_update": sum(1 for p in out if not p["latest_health"]),
        "stale": sum(1 for p in out if p["is_stale"]),
    }
    return {"projects": out, "summary": summary, "current_week": _monday_of()}


@frappe.whitelist()
def get_draft_for(project: str, week_start: str | None = None) -> dict:
    """Сгенерировать черновик апдейта по активности за неделю (без AI — простая агрегация).

    Если есть OPENAI_API_KEY / ANTHROPIC_API_KEY — может вызвать LLM для саммаризации
    (на будущее). Сейчас собираем events и предлагаем как сырой материал.
    """
    frappe.has_permission("Construction Project Update", throw=True)
    if not frappe.db.exists("Construction Project", project):
        frappe.throw(f"Проект {project} не найден")

    week = _monday_of(week_start)
    week_end = (getdate(week) + timedelta(days=6)).strftime("%Y-%m-%d")

    # Что произошло за неделю
    facts: list[str] = []

    # КС-2 подписанные
    ks2 = frappe.db.sql("""
        SELECT name, act_number, amount FROM `tabKS2 Act`
        WHERE project = %(p)s AND status = 'Подписан' AND signed_date BETWEEN %(s)s AND %(e)s
    """, {"p": project, "s": week, "e": week_end}, as_dict=True)
    for k in ks2:
        facts.append(f"Подписан КС-2 №{k['act_number']} на {k['amount']:,.0f} ₽")

    # Закрытые Schedule Task
    closed = frappe.db.sql("""
        SELECT name, title FROM `tabSchedule Task`
        WHERE project = %(p)s AND status = 'Завершена' AND modified BETWEEN %(s)s AND %(e)s
    """, {"p": project, "s": week, "e": week_end + " 23:59:59"}, as_dict=True)
    for t in closed:
        facts.append(f"Завершена работа: {t['title']}")

    # Новые риски
    risks = frappe.db.sql("""
        SELECT name, title, risk_score FROM `tabProject Risk`
        WHERE project = %(p)s AND creation BETWEEN %(s)s AND %(e)s
    """, {"p": project, "s": week, "e": week_end + " 23:59:59"}, as_dict=True)
    for r in risks:
        facts.append(f"Зафиксирован риск: {r['title']} (score={r['risk_score']})")

    # Открытые блокеры (Punch List критичные + просроченные)
    blockers_facts: list[str] = []
    open_punch = frappe.db.sql("""
        SELECT name, title, urgency FROM `tabPunch List Item`
        WHERE project = %(p)s AND status NOT IN ('Закрыт', 'Отменён')
              AND (urgency IN ('Критично', 'Высокая') OR due_date < %(today)s)
        LIMIT 5
    """, {"p": project, "today": nowdate()}, as_dict=True)
    for b in open_punch:
        blockers_facts.append(f"{b['urgency']}: {b['title']}")

    # CPI/SPI снимок
    snap = frappe.db.get_value(
        "EVM Snapshot", {"project": project},
        ["cpi", "spi", "snapshot_date"],
        order_by="snapshot_date DESC",
    )
    health_hint = "🟢 Зелёный"
    if snap:
        cpi, spi, _ = snap
        if cpi < 0.85 or spi < 0.85:
            health_hint = "🔴 Красный"
        elif cpi < 0.95 or spi < 0.95:
            health_hint = "🟡 Жёлтый"

    # Если нет фактов — добавим заглушку
    if not facts:
        facts.append("За неделю существенных событий не зафиксировано в системе.")

    return {
        "week_start": week,
        "week_end": week_end,
        "project": project,
        "suggested_health": health_hint,
        "summary_draft": "\n".join(f"• {f}" for f in facts),
        "blockers_draft": "\n".join(f"• {b}" for b in blockers_facts) if blockers_facts else "",
        "cpi": snap[0] if snap else None,
        "spi": snap[1] if snap else None,
        "facts_count": len(facts),
    }
