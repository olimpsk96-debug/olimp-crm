"""EVM (Earned Value Management) — прогноз стоимости и темпов проекта.

Метрики:
- BAC (Budget at Completion)      — плановая стоимость проекта (planned_cost)
- AC  (Actual Cost)               — фактические расходы (Material Request: Одобрена/Закупается/Получена)
- EV  (Earned Value)              — % выполнения × BAC (% по подписанным КС-2 от контракта)
- PV  (Planned Value)             — линейный прогноз по времени от start_date до planned_end_date
- CPI = EV / AC                   — индекс производительности по стоимости (>1 — экономия)
- SPI = EV / PV                   — индекс производительности по срокам (>1 — опережение)
- EAC = BAC / CPI                 — прогноз итоговой стоимости
- ETC = EAC - AC                  — сколько осталось потратить
- VAC = BAC - EAC                 — отклонение от плана (положительное — экономия)
- TCPI = (BAC - EV) / (BAC - AC)  — нужный темп для выполнения в бюджет

Все суммы в ₽. CPI/SPI/TCPI безразмерные (1.0 = норма).
"""
from __future__ import annotations

from datetime import date, datetime

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate


@frappe.whitelist()
def get_forecast(project: str) -> dict:
    """Считает EVM-метрики для проекта на текущую дату."""
    frappe.has_permission("Construction Project", "read", doc=project, throw=True)

    if not frappe.db.exists("Construction Project", project):
        frappe.throw(_(f"Проект {project} не найден"))

    proj = frappe.get_doc("Construction Project", project)
    today = getdate(nowdate())

    contract_amount = flt(proj.contract_amount or 0)
    planned_cost = flt(proj.planned_cost or 0)
    # BAC — плановая стоимость работ. Если planned_cost не задан, используем contract_amount × (1 - planned_margin)
    if planned_cost <= 0 and contract_amount > 0:
        margin = flt(proj.planned_margin_pct or 0) / 100.0
        planned_cost = contract_amount * (1 - margin)

    bac = planned_cost
    if bac <= 0:
        return _empty_forecast(project, reason="Не задана плановая себестоимость (planned_cost) и контракт (contract_amount)")

    # AC — фактические расходы по Material Request
    ac = flt(frappe.db.sql(
        """SELECT IFNULL(SUM(total_estimated), 0)
           FROM `tabMaterial Request`
           WHERE project = %s AND status IN ('Одобрена', 'Закупается', 'Получена')""",
        (project,),
    )[0][0])

    # Учтём ещё ChangeOrder approved_amount как доп. фактический расход
    co_approved = flt(frappe.db.sql(
        """SELECT IFNULL(SUM(approved_amount), 0)
           FROM `tabChange Order`
           WHERE project = %s AND status = 'Одобрен'""",
        (project,),
    )[0][0]) if frappe.db.exists("DocType", "Change Order") else 0.0

    # % выполнения = подписанные КС-2 / контракт
    ks2_signed = flt(frappe.db.sql(
        """SELECT IFNULL(SUM(amount), 0)
           FROM `tabKS2 Act`
           WHERE project = %s AND status = 'Подписан'""",
        (project,),
    )[0][0])

    completion_pct = (ks2_signed / contract_amount * 100.0) if contract_amount > 0 else 0.0
    completion_pct = min(100.0, completion_pct)

    # EV = % выполнения × BAC
    ev = bac * (completion_pct / 100.0)

    # PV — линейный прогноз: где должны были быть к сегодня
    pv = _planned_value(proj, today, bac)

    cpi = (ev / ac) if ac > 0 else 0.0
    spi = (ev / pv) if pv > 0 else 0.0

    # EAC (наиболее частая формула: BAC / CPI)
    eac = (bac / cpi) if cpi > 0 else bac
    etc = max(0.0, eac - ac)
    vac = bac - eac

    # TCPI: нужный темп для выполнения в бюджет
    remaining_budget = bac - ac
    remaining_work = bac - ev
    tcpi = (remaining_work / remaining_budget) if remaining_budget > 0 else 0.0

    # Health: интегральная оценка
    health = _classify_health(cpi, spi, tcpi)

    return {
        "project": project,
        "as_of": str(today),
        "bac": round(bac, 2),
        "ac": round(ac, 2),
        "ev": round(ev, 2),
        "pv": round(pv, 2),
        "co_approved": round(co_approved, 2),
        "contract_amount": round(contract_amount, 2),
        "completion_pct": round(completion_pct, 2),
        "cpi": round(cpi, 3),
        "spi": round(spi, 3),
        "eac": round(eac, 2),
        "etc": round(etc, 2),
        "vac": round(vac, 2),
        "tcpi": round(tcpi, 3),
        "health": health,
        "warnings": _build_warnings(cpi, spi, tcpi, ac, ev, vac),
    }


def _planned_value(proj, today: date, bac: float) -> float:
    """Линейный планируемый расход по календарю (PV).

    Если today < start — PV=0, если today > planned_end — PV=BAC.
    Иначе пропорционально (today - start) / (end - start).
    """
    start = getdate(proj.start_date) if proj.start_date else None
    end = getdate(proj.planned_end_date) if proj.planned_end_date else None
    if not start or not end or end <= start:
        return bac * 0.5  # без дат — считаем что мы посредине

    if today <= start:
        return 0.0
    if today >= end:
        return bac

    total_days = (end - start).days
    elapsed_days = (today - start).days
    return bac * (elapsed_days / total_days)


def _classify_health(cpi: float, spi: float, tcpi: float) -> dict:
    """Оценка здоровья проекта по 5-балльной шкале."""
    if cpi == 0 and spi == 0:
        return {"level": "unknown", "label": "Нет данных", "color": "var(--text-tertiary)"}

    # Худший из двух индексов
    worst = min(cpi or 1.0, spi or 1.0)

    if worst >= 1.0:
        return {"level": "excellent", "label": "Опережает план", "color": "var(--success)"}
    if worst >= 0.95:
        return {"level": "good", "label": "В плане", "color": "var(--success)"}
    if worst >= 0.85:
        return {"level": "warning", "label": "Тревожный сигнал", "color": "var(--warning)"}
    if worst >= 0.7:
        return {"level": "critical", "label": "Серьёзное отставание", "color": "var(--danger)"}
    return {"level": "disaster", "label": "Критический срыв", "color": "var(--danger)"}


def _build_warnings(cpi: float, spi: float, tcpi: float, ac: float, ev: float, vac: float) -> list[str]:
    """Список текстовых предупреждений на основе метрик."""
    warnings = []
    if cpi > 0 and cpi < 0.9:
        warnings.append(f"CPI = {cpi:.2f}: тратим больше, чем выполняем работ. Перерасход бюджета.")
    if spi > 0 and spi < 0.9:
        warnings.append(f"SPI = {spi:.2f}: работы отстают от плана-графика.")
    if tcpi > 1.1:
        warnings.append(f"TCPI = {tcpi:.2f}: чтобы уложиться в бюджет, темп производительности нужно повысить на {(tcpi - 1) * 100:.0f}%.")
    if vac < 0:
        warnings.append(f"Прогноз перерасхода: {-vac:,.0f} ₽ сверх бюджета.".replace(",", " "))
    return warnings


def _empty_forecast(project: str, reason: str) -> dict:
    return {
        "project": project,
        "as_of": nowdate(),
        "bac": 0.0, "ac": 0.0, "ev": 0.0, "pv": 0.0,
        "contract_amount": 0.0, "completion_pct": 0.0,
        "cpi": 0.0, "spi": 0.0, "eac": 0.0, "etc": 0.0, "vac": 0.0, "tcpi": 0.0,
        "co_approved": 0.0,
        "health": {"level": "unknown", "label": "Нет данных", "color": "var(--text-tertiary)"},
        "warnings": [reason],
    }


# ───────────────────────── EVM Snapshot / S-curve ───────────────────────────


def save_snapshot(project: str) -> str | None:
    """Сохраняет текущие EVM-метрики проекта в `EVM Snapshot`. Один снимок в день.

    Используется ежедневным cron `save_daily_evm_snapshots()` и при запросе
    `get_trend(force_refresh=True)`.
    """
    fc = get_forecast(project)
    today_iso = nowdate()
    name = f"EVMS-{project}-{today_iso}"

    # Если снимок за сегодня уже есть — перезапишем (актуальный конец дня)
    if frappe.db.exists("EVM Snapshot", name):
        doc = frappe.get_doc("EVM Snapshot", name)
    else:
        doc = frappe.new_doc("EVM Snapshot")
        doc.project = project
        doc.snapshot_date = today_iso

    doc.health_level = (fc.get("health") or {}).get("level", "unknown")
    doc.completion_pct = fc.get("completion_pct", 0)
    doc.bac = fc.get("bac", 0)
    doc.ac = fc.get("ac", 0)
    doc.ev = fc.get("ev", 0)
    doc.pv = fc.get("pv", 0)
    doc.eac = fc.get("eac", 0)
    doc.vac = fc.get("vac", 0)
    doc.etc = fc.get("etc", 0)
    doc.cpi = fc.get("cpi", 0)
    doc.spi = fc.get("spi", 0)
    doc.tcpi = fc.get("tcpi", 0)
    doc.save(ignore_permissions=True)
    return doc.name


@frappe.whitelist()
def save_daily_evm_snapshots() -> dict:
    """Daily cron: сохраняет EVM-снимки по всем активным проектам.

    Активные = status в ('В работе', 'Запланирован'). Если у проекта не задан
    `planned_cost`/`contract_amount`, снимок не создаётся (вернётся reason в warnings).
    """
    active_statuses = ("В работе", "Запланирован")
    rows = frappe.get_all(
        "Construction Project",
        filters={"status": ["in", active_statuses]},
        pluck="name",
    )
    saved, skipped = [], []
    for project in rows:
        try:
            name = save_snapshot(project)
            if name:
                saved.append(name)
        except Exception as exc:
            frappe.log_error(f"EVM snapshot failed for {project}: {exc}", "evm_snapshot")
            skipped.append(project)
    frappe.db.commit()
    return {"saved": saved, "skipped": skipped, "count": len(saved)}


@frappe.whitelist()
def get_trend(project: str, days: int = 90) -> dict:
    """Возвращает историю EVM-снимков за последние N дней для построения S-curve.

    Если за сегодня снимка нет — создаёт его на лету (чтобы график всегда был
    актуален при первом открытии страницы проекта).
    """
    frappe.has_permission("Construction Project", "read", doc=project, throw=True)

    days = int(days) if days else 90
    if not frappe.db.exists("EVM Snapshot", f"EVMS-{project}-{nowdate()}"):
        try:
            save_snapshot(project)
            frappe.db.commit()
        except Exception:
            pass

    rows = frappe.db.sql(
        """SELECT snapshot_date, bac, ac, ev, pv, eac,
                  cpi, spi, tcpi, completion_pct, health_level
             FROM `tabEVM Snapshot`
            WHERE project = %s
              AND snapshot_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            ORDER BY snapshot_date ASC""",
        (project, days),
        as_dict=True,
    )
    series = [
        {
            "date": str(r["snapshot_date"]),
            "bac": flt(r["bac"]),
            "ac": flt(r["ac"]),
            "ev": flt(r["ev"]),
            "pv": flt(r["pv"]),
            "eac": flt(r["eac"]),
            "cpi": flt(r["cpi"]),
            "spi": flt(r["spi"]),
            "tcpi": flt(r["tcpi"]),
            "completion_pct": flt(r["completion_pct"]),
            "health_level": r["health_level"],
        }
        for r in rows
    ]
    return {"project": project, "days": days, "count": len(series), "series": series}
