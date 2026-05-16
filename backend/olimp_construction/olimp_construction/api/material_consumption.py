"""API для расхода материалов прорабом (Materials Usage).

Идея из BuilderTrend Daily Log: прораб в полях добавляет «израсходовано:
цемент М500 — 12 мешков, грунт ГФ-021 — 4 л». При подтверждении бухгалтером
создаётся Stock Movement расход с проекта.

Workflow: Черновик → Подтверждён → (нажатие «Списать со склада») → Списан
со склада (создаёт Stock Movement type=«Расход»). Stock Movement.before_save
сам пересчитает остатки и avg_price.
"""
from __future__ import annotations

import frappe
from frappe.utils import add_days, now_datetime, nowdate


VALID_STATUSES = ("Черновик", "Подтверждён", "Списан со склада", "Отклонён")


@frappe.whitelist()
def list_consumptions(project: str | None = None, status: str | None = None,
                      days: int = 90, limit: int = 200) -> list[dict]:
    frappe.has_permission("Material Consumption", throw=True)

    filters: dict = {"consumed_date": [">=", add_days(nowdate(), -int(days))]}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status

    rows = frappe.get_all(
        "Material Consumption",
        filters=filters,
        fields=["name", "project", "consumed_date", "foreman_name",
                "stock_item", "material_name_text", "qty", "unit",
                "unit_price", "amount", "status", "stock_movement_ref",
                "confirmed_by", "confirmed_at", "notes",
                "owner", "creation", "modified"],
        order_by="consumed_date DESC, creation DESC",
        limit_page_length=int(limit),
    )
    for r in rows:
        r["project_title"] = frappe.db.get_value("Construction Project", r["project"], "title") or r["project"]
        if r["stock_item"]:
            r["stock_item_name"] = frappe.db.get_value("Stock Item", r["stock_item"], "item_name") or r["stock_item"]
    return rows


@frappe.whitelist()
def save_consumption(name: str | None = None, project: str = "",
                     consumed_date: str | None = None, foreman_name: str = "",
                     foreman_report: str = "",
                     stock_item: str = "", material_name_text: str = "",
                     qty: float = 0, unit: str = "", unit_price: float = 0,
                     notes: str = "", status: str = "Черновик") -> dict:
    if not project:
        frappe.throw("project обязателен")
    if status not in VALID_STATUSES:
        frappe.throw(f"status must be one of {VALID_STATUSES}")
    if not stock_item and not material_name_text.strip():
        frappe.throw("Укажите stock_item или material_name_text")
    if float(qty or 0) <= 0:
        frappe.throw("qty должен быть > 0")

    if name and frappe.db.exists("Material Consumption", name):
        frappe.has_permission("Material Consumption", "write", doc=name, throw=True)
        doc = frappe.get_doc("Material Consumption", name)
        if doc.status == "Списан со склада":
            frappe.throw("Списанная запись не редактируется. Создайте корректировку.")
        action = "updated"
    else:
        frappe.has_permission("Material Consumption", "create", throw=True)
        doc = frappe.new_doc("Material Consumption")
        action = "created"

    doc.project = project
    doc.consumed_date = consumed_date or nowdate()
    doc.foreman_name = (foreman_name or "").strip()[:140]
    doc.foreman_report = foreman_report or None
    doc.stock_item = stock_item or None
    doc.material_name_text = (material_name_text or "").strip()[:140]
    doc.qty = float(qty)
    doc.unit = (unit or "").strip()[:30]
    doc.unit_price = float(unit_price or 0)
    doc.notes = (notes or "").strip()[:1000]
    doc.status = status

    # Auto-fill из Stock Item (если custom DocType, before_save из .py не вызовется)
    if doc.stock_item:
        si = frappe.db.get_value(
            "Stock Item", doc.stock_item,
            ["item_name", "unit", "avg_price"], as_dict=True,
        )
        if si:
            if not doc.material_name_text:
                doc.material_name_text = si.get("item_name")
            if not doc.unit:
                doc.unit = si.get("unit") or ""
            if doc.unit_price == 0 and si.get("avg_price"):
                doc.unit_price = float(si["avg_price"])

    # Amount считаем здесь — у custom DocType before_save из .py может не вызываться
    doc.amount = float(doc.qty or 0) * float(doc.unit_price or 0)

    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name, "action": action,
            "amount": float(doc.amount or 0)}


@frappe.whitelist()
def confirm_consumption(name: str) -> dict:
    """Подтверждает запись (не создаёт Stock Movement)."""
    frappe.has_permission("Material Consumption", "write", doc=name, throw=True)
    doc = frappe.get_doc("Material Consumption", name)
    if doc.status not in ("Черновик", "Отклонён"):
        return {"ok": True, "skipped": f"already {doc.status}"}
    doc.status = "Подтверждён"
    doc.confirmed_by = frappe.session.user
    doc.confirmed_at = now_datetime()
    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name}


@frappe.whitelist()
def writeoff_to_stock(name: str) -> dict:
    """Списать материал со склада: создаёт Stock Movement type=«Расход»."""
    frappe.has_permission("Material Consumption", "write", doc=name, throw=True)
    frappe.has_permission("Stock Movement", "create", throw=True)

    doc = frappe.get_doc("Material Consumption", name)
    if doc.status == "Списан со склада":
        return {"ok": True, "skipped": "already_written_off", "stock_movement": doc.stock_movement_ref}
    if not doc.stock_item:
        frappe.throw("Расход без stock_item нельзя списать со склада. "
                     "Сначала привяжите материал к Stock Item или создайте Stock Item.")
    if doc.status == "Черновик":
        # Авто-подтверждаем
        doc.status = "Подтверждён"
        doc.confirmed_by = frappe.session.user
        doc.confirmed_at = now_datetime()

    # Создаём Stock Movement
    si = frappe.db.get_value("Stock Item", doc.stock_item,
                             ["item_name", "default_warehouse", "avg_price"], as_dict=True)
    if not si:
        frappe.throw(f"Stock Item {doc.stock_item} не найден")

    sm = frappe.get_doc({
        "doctype": "Stock Movement",
        "title": f"Расход {si.get('item_name')} на {doc.project} ({doc.qty} {doc.unit or ''})",
        "movement_type": "Расход",
        "movement_date": doc.consumed_date or nowdate(),
        "stock_item": doc.stock_item,
        "qty": float(doc.qty or 0),
        "unit_price": float(doc.unit_price or si.get("avg_price") or 0),
        "warehouse": si.get("default_warehouse"),
        "project": doc.project,
        "responsible": doc.foreman_name or frappe.session.user,
        "notes": f"Material Consumption {doc.name}. {doc.notes or ''}".strip()[:1000],
    })
    sm.insert(ignore_permissions=True)

    doc.status = "Списан со склада"
    doc.stock_movement_ref = sm.name
    doc.save(ignore_permissions=False)
    frappe.db.commit()

    return {"ok": True, "name": doc.name, "stock_movement": sm.name,
            "amount": float(doc.amount or 0)}


@frappe.whitelist()
def reject_consumption(name: str, reason: str = "") -> dict:
    frappe.has_permission("Material Consumption", "write", doc=name, throw=True)
    doc = frappe.get_doc("Material Consumption", name)
    if doc.status == "Списан со склада":
        frappe.throw("Нельзя отклонить уже списанный расход")
    doc.status = "Отклонён"
    if reason:
        doc.notes = (doc.notes or "") + f"\n[Отклонено]: {reason}"[:1000]
    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name}


@frappe.whitelist()
def delete_consumption(name: str) -> dict:
    frappe.has_permission("Material Consumption", "delete", doc=name, throw=True)
    doc = frappe.get_doc("Material Consumption", name)
    if doc.status == "Списан со склада":
        frappe.throw("Нельзя удалить списанный расход (созданы Stock Movement)")
    frappe.delete_doc("Material Consumption", name, ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist()
def get_summary(project: str | None = None, days: int = 30) -> dict:
    """Сводка: сколько материалов израсходовано по проектам за период."""
    frappe.has_permission("Material Consumption", throw=True)

    filters_sql = "WHERE consumed_date >= DATE_SUB(CURDATE(), INTERVAL %(d)s DAY)"
    params: dict = {"d": int(days)}
    if project:
        filters_sql += " AND project = %(p)s"
        params["p"] = project

    by_project = frappe.db.sql(f"""
        SELECT project,
               SUM(CASE WHEN status='Списан со склада' THEN amount ELSE 0 END) AS written_off,
               SUM(CASE WHEN status='Подтверждён' THEN amount ELSE 0 END) AS confirmed,
               SUM(CASE WHEN status='Черновик' THEN amount ELSE 0 END) AS draft,
               COUNT(*) AS total_count,
               COUNT(CASE WHEN status='Черновик' THEN 1 END) AS draft_count
        FROM `tabMaterial Consumption`
        {filters_sql}
        GROUP BY project
        ORDER BY written_off DESC
    """, params, as_dict=True)

    for r in by_project:
        r["project_title"] = frappe.db.get_value("Construction Project", r["project"], "title") or r["project"]
        r["total_amount"] = float(r["written_off"] or 0) + float(r["confirmed"] or 0) + float(r["draft"] or 0)

    totals = frappe.db.sql(f"""
        SELECT
            SUM(CASE WHEN status='Списан со склада' THEN amount ELSE 0 END) AS written_off,
            SUM(CASE WHEN status='Подтверждён' THEN amount ELSE 0 END) AS confirmed,
            SUM(CASE WHEN status='Черновик' THEN amount ELSE 0 END) AS draft,
            COUNT(*) AS total
        FROM `tabMaterial Consumption`
        {filters_sql}
    """, params, as_dict=True)[0]

    return {
        "by_project": by_project,
        "totals": {
            "written_off": float(totals["written_off"] or 0),
            "confirmed": float(totals["confirmed"] or 0),
            "draft": float(totals["draft"] or 0),
            "total_count": int(totals["total"] or 0),
        },
        "period_days": int(days),
    }
