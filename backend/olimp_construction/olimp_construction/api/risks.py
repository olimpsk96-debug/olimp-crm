"""API для реестра рисков (Project Risk).

Эндпоинты:
- get_list(project?) — список рисков с фильтрами
- get_summary(project?) — KPI: total / open / critical / contingency_total / by_zone
- get_matrix(project?) — данные для матрицы 5×5: [{p, i, count, items[]}]
- save_risk(data) — создание/обновление (контингенция считается в before_save модели)
- delete_risk(name)
- apply_to_estimate(risk, estimate) — добавляет позицию контингенции в смету (резерв)
"""
from __future__ import annotations

import json

import frappe
from frappe.utils import flt, today


def _parse_level(s) -> int:
    if not s:
        return 0
    try:
        return int(str(s).split("—")[0].strip())
    except (ValueError, IndexError):
        return 0


# ── List / matrix / summary ──────────────────────────────────────────────────

@frappe.whitelist()
def get_list(
    project: str | None = None,
    status: str | None = None,
    category: str | None = None,
    min_score: int | None = None,
) -> list[dict]:
    """Список рисков с фильтрами. Сортировка: score DESC."""
    frappe.has_permission("Project Risk", throw=True)

    filters: dict = {}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status
    if category:
        filters["category"] = category
    if min_score is not None:
        filters["risk_score"] = [">=", int(min_score)]

    rows = frappe.get_all(
        "Project Risk",
        filters=filters,
        fields=[
            "name", "title", "project", "category", "status",
            "probability", "impact", "risk_score",
            "impact_amount", "contingency_amount",
            "response_strategy", "owner_full_name",
            "detected_date", "target_resolution_date",
            "linked_estimate",
        ],
        order_by="risk_score desc, creation desc",
        limit_page_length=500,
    )
    return rows


@frappe.whitelist()
def get_summary(project: str | None = None) -> dict:
    """KPI и распределение по зонам."""
    frappe.has_permission("Project Risk", throw=True)

    where = "WHERE 1=1"
    params: dict = {}
    if project:
        where += " AND project = %(p)s"
        params["p"] = project

    row = frappe.db.sql(
        f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status IN ('Открыт', 'В работе') THEN 1 ELSE 0 END) AS open_count,
            SUM(CASE WHEN status = 'Реализовался' THEN 1 ELSE 0 END) AS materialized,
            SUM(CASE WHEN risk_score >= 15 THEN 1 ELSE 0 END) AS red_zone,
            SUM(CASE WHEN risk_score >= 8 AND risk_score < 15 THEN 1 ELSE 0 END) AS yellow_zone,
            SUM(CASE WHEN risk_score > 0 AND risk_score < 8 THEN 1 ELSE 0 END) AS green_zone,
            COALESCE(SUM(CASE WHEN status IN ('Открыт', 'В работе') THEN contingency_amount ELSE 0 END), 0) AS contingency_total,
            COALESCE(SUM(impact_amount), 0) AS max_exposure
        FROM `tabProject Risk`
        {where}
        """,
        params, as_dict=True,
    )[0]

    return {
        "total": int(row.get("total") or 0),
        "open_count": int(row.get("open_count") or 0),
        "materialized": int(row.get("materialized") or 0),
        "red_zone": int(row.get("red_zone") or 0),
        "yellow_zone": int(row.get("yellow_zone") or 0),
        "green_zone": int(row.get("green_zone") or 0),
        "contingency_total": flt(row.get("contingency_total") or 0),
        "max_exposure": flt(row.get("max_exposure") or 0),
    }


@frappe.whitelist()
def get_matrix(project: str | None = None) -> list[dict]:
    """Данные для 5×5 матрицы. Возвращает массив ячеек.

    [{"p": 1..5, "i": 1..5, "count": N, "score": p*i, "items": [{name, title, risk_score}, ...]}]
    """
    frappe.has_permission("Project Risk", throw=True)

    filters: dict = {"status": ["in", ("Открыт", "В работе")]}
    if project:
        filters["project"] = project

    rows = frappe.get_all(
        "Project Risk",
        filters=filters,
        fields=["name", "title", "probability", "impact", "risk_score", "impact_amount"],
        limit_page_length=2000,
    )

    # Группируем по (p, i)
    matrix: dict[tuple[int, int], dict] = {}
    for r in rows:
        p = _parse_level(r.get("probability"))
        i = _parse_level(r.get("impact"))
        if not p or not i:
            continue
        key = (p, i)
        if key not in matrix:
            matrix[key] = {"p": p, "i": i, "score": p * i, "count": 0, "items": []}
        matrix[key]["count"] += 1
        matrix[key]["items"].append({
            "name": r["name"],
            "title": r["title"],
            "risk_score": r["risk_score"],
            "impact_amount": flt(r.get("impact_amount") or 0),
        })

    # Заполняем все ячейки даже пустые (для рендера сетки)
    out = []
    for p in range(1, 6):
        for i in range(1, 6):
            if (p, i) in matrix:
                out.append(matrix[(p, i)])
            else:
                out.append({"p": p, "i": i, "score": p * i, "count": 0, "items": []})
    return out


# ── Save / delete ────────────────────────────────────────────────────────────

@frappe.whitelist()
def save_risk(data: dict | str) -> dict:
    """Создать/обновить риск. risk_score и contingency_amount считаются в модели."""
    frappe.has_permission("Project Risk", "create", throw=True)
    if isinstance(data, str):
        data = json.loads(data)

    name = data.get("name")
    if name and frappe.db.exists("Project Risk", name):
        frappe.has_permission("Project Risk", "write", doc=name, throw=True)
        doc = frappe.get_doc("Project Risk", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"name": doc.name, "updated": True, "risk_score": doc.risk_score, "contingency_amount": flt(doc.contingency_amount)}

    data.setdefault("detected_date", today())
    doc = frappe.get_doc({"doctype": "Project Risk", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "created": True, "risk_score": doc.risk_score, "contingency_amount": flt(doc.contingency_amount)}


@frappe.whitelist()
def delete_risk(name: str) -> dict:
    frappe.has_permission("Project Risk", "delete", doc=name, throw=True)
    frappe.delete_doc("Project Risk", name, ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "deleted": name}


# ── Apply contingency to estimate ────────────────────────────────────────────

@frappe.whitelist()
def apply_to_estimate(risk: str, estimate: str) -> dict:
    """Добавляет позицию контингенции в указанную смету.

    Создаёт Estimate Item с маркером 'РИСК-РЕЗЕРВ' = риск.title, qty=1, our_unit_price=contingency_amount.
    Помечает Project Risk.linked_estimate = estimate.
    """
    frappe.has_permission("Project Risk", "write", doc=risk, throw=True)
    frappe.has_permission("Estimate", "write", doc=estimate, throw=True)

    r = frappe.get_doc("Project Risk", risk)
    if not r.contingency_amount or flt(r.contingency_amount) <= 0:
        frappe.throw("У риска нулевая контингенция — заполните Impact amount")

    est = frappe.get_doc("Estimate", estimate)
    # Добавим в items
    item = est.append("items", {
        "item_code": f"RISK-{r.name}",
        "item_name": f"Резерв на риск: {r.title}",
        "unit": "ед.",
        "qty": 1,
        "our_unit_price": flt(r.contingency_amount),
    })
    est.save(ignore_permissions=True)

    r.linked_estimate = estimate
    r.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "ok": True,
        "risk": risk,
        "estimate": estimate,
        "item_added": getattr(item, "name", None),
        "amount": flt(r.contingency_amount),
    }
