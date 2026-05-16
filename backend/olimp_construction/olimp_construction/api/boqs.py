"""API для списка BOQ (главный список + summary + создание из Estimate).

Полное редактирование BOQ — через Frappe-админку (/app/boq), здесь только
list/create/summary/clone-from-estimate.
"""
from __future__ import annotations

import frappe
from frappe.utils import add_days, nowdate


VALID_STATUSES = ("Draft", "Submitted", "Won", "Lost", "Archived")


@frappe.whitelist()
def list_boqs(status: str | None = None, customer: str | None = None,
              project: str | None = None, days: int = 365,
              limit: int = 100) -> list[dict]:
    frappe.has_permission("BOQ", throw=True)

    filters: dict = {"modified": [">=", add_days(nowdate(), -int(days))]}
    if status:
        filters["status"] = status
    if customer:
        filters["customer"] = customer
    if project:
        filters["project"] = project

    rows = frappe.get_all(
        "BOQ",
        filters=filters,
        fields=["name", "title", "project", "customer", "version", "status",
                "boq_date", "valid_until", "direct_cost", "subtotal_before_vat",
                "grand_total", "vat_percent", "overhead_percent", "profit_percent",
                "oce_boq_id", "modified"],
        order_by="modified DESC",
        limit_page_length=int(limit),
    )
    for r in rows:
        if r.get("customer"):
            r["customer_name"] = frappe.db.get_value("Customer", r["customer"], "customer_name") or r["customer"]
        if r.get("project"):
            r["project_title"] = frappe.db.get_value("Construction Project", r["project"], "title") or r["project"]
        r["positions_count"] = frappe.db.count("BOQ Position", {"parent": r["name"]})
    return rows


@frappe.whitelist()
def get_summary(days: int = 365) -> dict:
    frappe.has_permission("BOQ", throw=True)

    totals = frappe.db.sql("""
        SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN status='Draft' THEN 1 END) AS draft,
          COUNT(CASE WHEN status='Submitted' THEN 1 END) AS submitted,
          COUNT(CASE WHEN status='Won' THEN 1 END) AS won,
          COUNT(CASE WHEN status='Lost' THEN 1 END) AS lost,
          SUM(CASE WHEN status='Won' THEN grand_total ELSE 0 END) AS won_amount,
          SUM(grand_total) AS total_amount
        FROM `tabBOQ`
        WHERE modified >= DATE_SUB(CURDATE(), INTERVAL %(d)s DAY)
    """, {"d": int(days)}, as_dict=True)[0]

    won = int(totals["won"] or 0)
    submitted = int(totals["submitted"] or 0)
    lost = int(totals["lost"] or 0)
    conv_base = won + lost
    return {
        "total": int(totals["total"] or 0),
        "draft": int(totals["draft"] or 0),
        "submitted": submitted,
        "won": won,
        "lost": lost,
        "won_amount": float(totals["won_amount"] or 0),
        "total_amount": float(totals["total_amount"] or 0),
        "conversion_pct": (won / conv_base * 100) if conv_base > 0 else 0,
    }


@frappe.whitelist()
def create_from_estimate(estimate: str, title: str = "") -> dict:
    """Создаёт BOQ на основе существующей Estimate с переносом позиций."""
    frappe.has_permission("BOQ", "create", throw=True)
    frappe.has_permission("Estimate", "read", doc=estimate, throw=True)

    est = frappe.get_doc("Estimate", estimate)

    doc = frappe.new_doc("BOQ")
    doc.title = title or f"BOQ из {est.name}"
    doc.project = est.project or None
    doc.customer = getattr(est, "customer", None) or None
    doc.estimate_link = est.name
    doc.version = 1
    doc.status = "Draft"
    doc.boq_date = nowdate()

    # Переносим items сметы в BOQ Section/Position
    current_section_code: str = "0"
    section_counters: dict = {}
    direct_cost = 0.0

    for it in (est.items or []):
        if int(it.is_section or 0):
            # Новая секция
            section_counters[current_section_code] = 0
            current_section_code = str(len(doc.sections) + 1)
            doc.append("sections", {
                "section_code": current_section_code,
                "section_name": (it.section_title or it.item_name or "Раздел")[:140],
                "subtotal": 0,
                "positions_count": 0,
            })
        else:
            # Позиция
            if current_section_code == "0":
                # Создаём секцию по-умолчанию
                doc.append("sections", {
                    "section_code": "1",
                    "section_name": "Основные работы",
                    "subtotal": 0,
                })
                current_section_code = "1"
            pos_num = section_counters.get(current_section_code, 0) + 1
            section_counters[current_section_code] = pos_num
            position_code = f"{current_section_code}.{pos_num}"

            qty = float(it.qty or 0)
            rate = float(it.our_unit_price or it.base_unit_price or 0)
            total = qty * rate
            direct_cost += total

            doc.append("positions", {
                "position_code": position_code,
                "section_code": current_section_code,
                "description": (it.item_name or "")[:1000],
                "unit": it.unit or "шт",
                "quantity": qty,
                "unit_rate": rate,
                "total": total,
                "resource_type": "composite",
            })

    # Итоги
    doc.direct_cost = direct_cost
    overhead = direct_cost * float(doc.overhead_percent or 8) / 100
    profit = direct_cost * float(doc.profit_percent or 15) / 100
    contingency = direct_cost * float(doc.contingency_percent or 5) / 100
    subtotal = direct_cost + overhead + profit + contingency
    vat = subtotal * float(doc.vat_percent or 20) / 100

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
        "positions": len(doc.positions or []),
        "sections": len(doc.sections or []),
        "direct_cost": float(direct_cost),
        "grand_total": float(doc.grand_total or 0),
    }


@frappe.whitelist()
def recalculate_totals(name: str) -> dict:
    """Пересчитать итоги BOQ (накладные/прибыль/НДС). Для bench/админки."""
    frappe.has_permission("BOQ", "write", doc=name, throw=True)
    doc = frappe.get_doc("BOQ", name)

    direct = sum(float(p.total or 0) for p in (doc.positions or []))
    overhead = direct * float(doc.overhead_percent or 0) / 100
    profit = direct * float(doc.profit_percent or 0) / 100
    contingency = direct * float(doc.contingency_percent or 0) / 100
    subtotal = direct + overhead + profit + contingency
    vat = subtotal * float(doc.vat_percent or 0) / 100

    doc.direct_cost = direct
    doc.overhead_amount = overhead
    doc.profit_amount = profit
    doc.contingency_amount = contingency
    doc.subtotal_before_vat = subtotal
    doc.vat_amount = vat
    doc.grand_total = subtotal + vat

    for section in doc.sections or []:
        positions_for_section = [p for p in (doc.positions or []) if p.section_code == section.section_code]
        section.subtotal = sum(float(p.total or 0) for p in positions_for_section)
        section.positions_count = len(positions_for_section)

    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {
        "ok": True,
        "direct_cost": direct,
        "grand_total": float(doc.grand_total or 0),
    }


@frappe.whitelist()
def change_status(name: str, status: str) -> dict:
    if status not in VALID_STATUSES:
        frappe.throw(f"status must be one of {VALID_STATUSES}")
    frappe.has_permission("BOQ", "write", doc=name, throw=True)
    frappe.db.set_value("BOQ", name, "status", status)
    frappe.db.commit()

    # При Won — Telegram уведомление
    if status == "Won":
        try:
            from olimp_construction.telegram_utils import send_message
            doc = frappe.get_doc("BOQ", name)
            send_message(
                f"🏆 <b>BOQ выиграна!</b>\n\n"
                f"<b>{doc.title}</b>\n"
                f"Сумма: {float(doc.grand_total or 0):,.0f} ₽".replace(",", " ")
            )
        except Exception:
            pass
    return {"ok": True, "status": status}


@frappe.whitelist()
def delete_boq(name: str) -> dict:
    frappe.has_permission("BOQ", "delete", doc=name, throw=True)
    frappe.delete_doc("BOQ", name, ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True}
