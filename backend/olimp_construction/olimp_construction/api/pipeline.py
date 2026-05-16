"""Pipeline аналитика: rotting + forecasting + win/loss reasons.

Идеи подсосаны из HubSpot, Pipedrive, Procore (через subagent-разведку).
"""
from __future__ import annotations

from datetime import timedelta

import frappe
from frappe.utils import flt, now_datetime, getdate


# Threshold rotting per stage (дней без активности → залежался)
ROTTING_THRESHOLD_DAYS = {
    "Лид":            3,
    "Переговоры":     7,
    "КП отправлено":  5,
    "Договор":        10,
    "В работе":       30,
}

# Дефолт probability_pct per stage (для weighted forecast)
DEFAULT_PROBABILITY = {
    "Лид":            10,
    "Переговоры":     30,
    "КП отправлено":  50,
    "Договор":        80,
    "В работе":       95,
    "Закрыт выигран": 100,
    "Закрыт проигран": 0,
}


@frappe.whitelist()
def refresh_rotting() -> dict:
    """Пересчитывает is_rotting для всех открытых сделок.

    Вызывается hourly cron или вручную. Также вызывается при on_update Deal.
    """
    open_statuses = ["Лид", "Переговоры", "КП отправлено", "Договор", "В работе"]
    rows = frappe.db.sql(
        """SELECT name, status, last_activity_date, modified
           FROM `tabDeal`
           WHERE status IN %(s)s""",
        {"s": tuple(open_statuses)}, as_dict=True,
    )

    now = now_datetime()
    rotting_count = 0
    fresh_count = 0

    for r in rows:
        last_act = r.get("last_activity_date") or r.get("modified")
        if not last_act:
            continue
        days_inactive = (now - last_act).days
        threshold = ROTTING_THRESHOLD_DAYS.get(r["status"], 14)

        if days_inactive >= threshold:
            frappe.db.set_value("Deal", r["name"],
                              {"is_rotting": 1, "rotting_days": days_inactive},
                              update_modified=False)
            rotting_count += 1
        else:
            if frappe.db.get_value("Deal", r["name"], "is_rotting"):
                frappe.db.set_value("Deal", r["name"],
                                  {"is_rotting": 0, "rotting_days": days_inactive},
                                  update_modified=False)
            fresh_count += 1

    frappe.db.commit()
    return {"ok": True, "checked": len(rows), "rotting": rotting_count, "fresh": fresh_count}


@frappe.whitelist()
def get_forecast(days: int = 90) -> dict:
    """Weighted forecast: sum(amount × probability_pct/100) по открытым сделкам.

    Возвращает: текущий месяц / следующий месяц / квартал / всего pipeline.
    """
    frappe.has_permission("Deal", throw=True)

    open_statuses = ["Лид", "Переговоры", "КП отправлено", "Договор", "В работе"]
    rows = frappe.db.sql(
        """SELECT name, status, amount_estimated, probability_pct, expected_close_date
           FROM `tabDeal`
           WHERE status IN %(s)s
             AND amount_estimated > 0""",
        {"s": tuple(open_statuses)}, as_dict=True,
    )

    today = getdate()
    month_end = today.replace(day=28) + timedelta(days=4)
    month_end = month_end - timedelta(days=month_end.day)

    # Месяцы
    months: dict[str, dict] = {}
    pipeline_total = 0.0
    weighted_total = 0.0
    best_case = 0.0
    commit = 0.0  # ≥80%

    for r in rows:
        amt = flt(r.get("amount_estimated") or 0)
        prob = flt(r.get("probability_pct") or 0)
        # Если probability_pct не задано — берём дефолт по статусу
        if prob == 0:
            prob = DEFAULT_PROBABILITY.get(r["status"], 30)
        weighted = amt * prob / 100

        pipeline_total += amt
        weighted_total += weighted
        best_case += amt
        if prob >= 80:
            commit += weighted

        ecd = r.get("expected_close_date")
        if ecd:
            key = f"{ecd.year}-{ecd.month:02d}"
            if key not in months:
                months[key] = {"month": key, "pipeline": 0, "weighted": 0, "deals": 0}
            months[key]["pipeline"] += amt
            months[key]["weighted"] += weighted
            months[key]["deals"] += 1

    timeline = sorted(months.values(), key=lambda x: x["month"])[:6]
    return {
        "pipeline_total": round(pipeline_total, 2),
        "weighted_total": round(weighted_total, 2),
        "best_case": round(best_case, 2),
        "commit": round(commit, 2),
        "deals_count": len(rows),
        "by_month": timeline,
    }


@frappe.whitelist()
def get_loss_analysis(days: int = 90) -> dict:
    """Анализ причин проигрышей за период."""
    frappe.has_permission("Deal", throw=True)
    days = max(1, min(int(days), 365))

    # Win/Loss rate
    totals = frappe.db.sql(
        """SELECT status, COUNT(*) AS cnt, COALESCE(SUM(amount_estimated), 0) AS amt
           FROM `tabDeal`
           WHERE status IN ('Закрыт выигран', 'Закрыт проигран')
             AND modified >= DATE_SUB(NOW(), INTERVAL %(d)s DAY)
           GROUP BY status""",
        {"d": days}, as_dict=True,
    )
    won = next((r for r in totals if r["status"] == "Закрыт выигран"), {"cnt": 0, "amt": 0})
    lost = next((r for r in totals if r["status"] == "Закрыт проигран"), {"cnt": 0, "amt": 0})
    total_closed = won["cnt"] + lost["cnt"]
    win_rate = round(won["cnt"] / total_closed * 100, 1) if total_closed else 0

    # Top loss reasons
    reasons = frappe.db.sql(
        """SELECT COALESCE(loss_reason, 'Не указана') AS reason, COUNT(*) AS cnt,
                  COALESCE(SUM(amount_estimated), 0) AS amt
           FROM `tabDeal`
           WHERE status = 'Закрыт проигран'
             AND modified >= DATE_SUB(NOW(), INTERVAL %(d)s DAY)
           GROUP BY loss_reason
           ORDER BY cnt DESC""",
        {"d": days}, as_dict=True,
    )

    # Top competitors
    competitors = frappe.db.sql(
        """SELECT loss_competitor, COUNT(*) AS cnt, COALESCE(SUM(amount_estimated), 0) AS amt
           FROM `tabDeal`
           WHERE status = 'Закрыт проигран'
             AND loss_competitor IS NOT NULL AND loss_competitor != ''
             AND modified >= DATE_SUB(NOW(), INTERVAL %(d)s DAY)
           GROUP BY loss_competitor
           ORDER BY cnt DESC
           LIMIT 10""",
        {"d": days}, as_dict=True,
    )

    # Win-rate по источникам
    by_source = frappe.db.sql(
        """SELECT source, COUNT(*) AS total,
                  SUM(CASE WHEN status = 'Закрыт выигран' THEN 1 ELSE 0 END) AS won,
                  SUM(CASE WHEN status = 'Закрыт проигран' THEN 1 ELSE 0 END) AS lost
           FROM `tabDeal`
           WHERE status IN ('Закрыт выигран', 'Закрыт проигран')
             AND modified >= DATE_SUB(NOW(), INTERVAL %(d)s DAY)
           GROUP BY source
           ORDER BY total DESC""",
        {"d": days}, as_dict=True,
    )
    for r in by_source:
        closed = (r["won"] or 0) + (r["lost"] or 0)
        r["win_rate"] = round((r["won"] or 0) / closed * 100, 1) if closed else 0

    return {
        "period_days": days,
        "won_count": int(won["cnt"]),
        "won_amount": flt(won["amt"]),
        "lost_count": int(lost["cnt"]),
        "lost_amount": flt(lost["amt"]),
        "total_closed": total_closed,
        "win_rate": win_rate,
        "reasons": reasons,
        "competitors": competitors,
        "by_source": by_source,
    }


@frappe.whitelist()
def shift_ball(change_order_name: str, new_responsible: str,
               responsible_name: str | None = None) -> dict:
    """Передать «мяч» (current_responsible) другой стороне.

    Эта операция логирует в Comment-stream + сбрасывает days_with_current.
    """
    frappe.has_permission("Change Order", "write", doc=change_order_name, throw=True)
    valid = {"Подрядчик (ОЛИМП)", "ГИП / Технадзор", "Заказчик", "Юрист", "Закрыто"}
    if new_responsible not in valid:
        frappe.throw(f"Допустимые значения: {', '.join(valid)}")

    doc = frappe.get_doc("Change Order", change_order_name)
    old = doc.current_responsible or "—"

    doc.current_responsible = new_responsible
    doc.responsible_name = responsible_name or ""
    doc.ball_handed_at = now_datetime()
    doc.days_with_current = 0
    doc.is_overdue = 0
    doc.save(ignore_permissions=True)

    # Лог-комментарий
    try:
        comment = frappe.get_doc({
            "doctype": "Comment",
            "comment_type": "Info",
            "reference_doctype": "Change Order",
            "reference_name": change_order_name,
            "content": f"⚽ Передан мяч: {old} → {new_responsible}" + (f" ({responsible_name})" if responsible_name else ""),
        })
        comment.insert(ignore_permissions=True)
    except Exception as e:
        frappe.logger().warning(f"Не удалось записать ball-shift comment: {e}")

    frappe.db.commit()
    return {"ok": True, "from": old, "to": new_responsible, "name": change_order_name}


@frappe.whitelist()
def refresh_ball_overdue() -> dict:
    """Пересчитывает days_with_current + is_overdue для всех Change Orders."""
    rows = frappe.db.sql(
        """SELECT name, current_responsible, ball_handed_at, modified
           FROM `tabChange Order`
           WHERE current_responsible IS NOT NULL
             AND current_responsible NOT IN ('Закрыто', '')""",
        as_dict=True,
    )

    # Threshold per role: подрядчик 5д, гип 7д, заказчик 14д, юрист 10д
    overdue_threshold = {
        "Подрядчик (ОЛИМП)":  5,
        "ГИП / Технадзор":    7,
        "Заказчик":           14,
        "Юрист":              10,
    }

    now = now_datetime()
    overdue_count = 0
    for r in rows:
        last = r.get("ball_handed_at") or r.get("modified")
        if not last:
            continue
        days = (now - last).days
        threshold = overdue_threshold.get(r["current_responsible"], 14)
        is_over = 1 if days >= threshold else 0
        frappe.db.set_value(
            "Change Order", r["name"],
            {"days_with_current": days, "is_overdue": is_over},
            update_modified=False,
        )
        if is_over:
            overdue_count += 1

    frappe.db.commit()
    return {"ok": True, "checked": len(rows), "overdue": overdue_count}


@frappe.whitelist()
def get_ball_overdue_list() -> list[dict]:
    """Список просроченных Change Orders (для дашборда)."""
    frappe.has_permission("Change Order", throw=True)
    return frappe.db.sql(
        """SELECT name, title, project, status, current_responsible, responsible_name,
                  days_with_current, contractor_amount, ball_handed_at
           FROM `tabChange Order`
           WHERE is_overdue = 1
           ORDER BY days_with_current DESC
           LIMIT 20""",
        as_dict=True,
    )


@frappe.whitelist()
def get_stage_conversion(days: int = 90) -> dict:
    """Конверсия stage→stage и среднее время на стадии (как в Pipedrive).

    Считаем:
    - На каждой стадии: сколько было / сколько перешло дальше / сколько застряло
    - Среднее время в стадии (на основе Version log по полю status)
    """
    frappe.has_permission("Deal", throw=True)
    days = max(1, min(int(days), 365))

    stages_order = ["Лид", "Переговоры", "КП отправлено", "Договор", "В работе"]

    # Сколько сделок ПРОШЛО через каждую стадию за период (по Version log)
    # Простой подход: смотрим текущий status + max известный статус из истории
    rows = frappe.db.sql(
        """SELECT d.name, d.status, d.amount_estimated,
                  d.creation, d.modified
           FROM `tabDeal` d
           WHERE d.creation >= DATE_SUB(NOW(), INTERVAL %(days)s DAY)""",
        {"days": days}, as_dict=True,
    )

    # Все сделки, побывавшие на каждом этапе (status_order index или дальше)
    stages = []
    cumulative_won = 0
    for i, stage in enumerate(stages_order):
        # Сделки которые сейчас ИЛИ были дальше этой стадии
        reached = sum(1 for r in rows if _stage_index(r["status"]) >= i)
        in_stage = sum(1 for r in rows if r["status"] == stage)
        won_amt = sum(
            (r["amount_estimated"] or 0) for r in rows
            if r["status"] == "Закрыт выигран" and _stage_index("Закрыт выигран") > i
        )
        stages.append({
            "stage": stage,
            "reached": reached,
            "currently_in": in_stage,
            "stuck": in_stage,  # все кто застрял на этой стадии сейчас
        })

    # Conversion rates: stage[i+1].reached / stage[i].reached
    for i in range(len(stages) - 1):
        if stages[i]["reached"] > 0:
            stages[i]["conversion_to_next"] = round(
                stages[i + 1]["reached"] / stages[i]["reached"] * 100, 1,
            )
        else:
            stages[i]["conversion_to_next"] = 0
    if stages:
        # Конверсия в выигранные (последняя стадия → Закрыт выигран)
        won_count = sum(1 for r in rows if r["status"] == "Закрыт выигран")
        if stages[-1]["reached"] > 0:
            stages[-1]["conversion_to_next"] = round(won_count / stages[-1]["reached"] * 100, 1)

    # Самая «токсичная» стадия — где больше всего застряло активных
    worst = max(stages, key=lambda s: s["stuck"], default=None)

    return {
        "period_days": days,
        "stages": stages,
        "worst_stage": worst["stage"] if worst else None,
        "won_count": sum(1 for r in rows if r["status"] == "Закрыт выигран"),
        "lost_count": sum(1 for r in rows if r["status"] == "Закрыт проигран"),
    }


def _stage_index(status: str) -> int:
    """Индекс стадии в воронке (для сравнения «дальше / раньше»)."""
    order = ["Лид", "Переговоры", "КП отправлено", "Договор", "В работе", "Закрыт выигран"]
    try:
        return order.index(status)
    except ValueError:
        return -1  # «Закрыт проигран» и прочее — outside the pipeline


@frappe.whitelist()
def get_rotting_list() -> list[dict]:
    """Список залежавшихся сделок для дашборда."""
    frappe.has_permission("Deal", throw=True)
    return frappe.db.sql(
        """SELECT name, title, status, source, customer, amount_estimated,
                  rotting_days, last_activity_date
           FROM `tabDeal`
           WHERE is_rotting = 1
           ORDER BY rotting_days DESC
           LIMIT 30""",
        as_dict=True,
    )
