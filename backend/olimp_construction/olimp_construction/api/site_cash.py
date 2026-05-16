"""API для кассы на объекте (Site Cash Entry).

Идея (1С:УНФ + Контур.Эльба): прораб на стройке тратит наличку — бетон, бригады без счёта.
Учётная политика:
- запись попадает в статус «Ждёт подтверждения»
- бухгалтер/директор подтверждает или отклоняет
- сальдо по проекту = Σ(Приход) − Σ(Расход) среди подтверждённых

Лимит остатка кассы пока не настраиваем — это для второй итерации (Custom Field на Project).
"""
from __future__ import annotations

import frappe
from frappe.utils import add_days, getdate, now_datetime, nowdate


VALID_TYPES = ("Приход", "Расход")
VALID_STATUSES = ("Черновик", "Ждёт подтверждения", "Подтверждён", "Отклонён")


@frappe.whitelist()
def list_entries(project: str | None = None, status: str | None = None,
                 entry_type: str | None = None, days: int = 90,
                 limit: int = 200) -> list[dict]:
    """Список записей кассы за период."""
    frappe.has_permission("Site Cash Entry", throw=True)

    filters: dict = {"date": [">=", add_days(nowdate(), -int(days))]}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status
    if entry_type:
        filters["entry_type"] = entry_type

    rows = frappe.get_all(
        "Site Cash Entry",
        filters=filters,
        fields=["name", "project", "entry_type", "operation_kind",
                "amount", "date", "foreman", "counterparty",
                "purpose", "comment", "receipt_image_url", "status",
                "confirmed_by", "confirmed_at", "rejection_reason",
                "owner", "creation", "modified"],
        order_by="date DESC, creation DESC",
        limit_page_length=int(limit),
    )
    for r in rows:
        r["project_title"] = frappe.db.get_value("Construction Project", r["project"], "title") or r["project"]
    return rows


@frappe.whitelist()
def save_entry(name: str | None = None, project: str = "",
               entry_type: str = "Расход", operation_kind: str = "Прочее",
               amount: float = 0, date: str | None = None,
               foreman: str = "", counterparty: str = "",
               purpose: str = "", comment: str = "",
               receipt_image_url: str = "",
               status: str = "Ждёт подтверждения") -> dict:
    """Создать или обновить запись."""
    if not project:
        frappe.throw("project обязателен")
    if entry_type not in VALID_TYPES:
        frappe.throw(f"entry_type должен быть одним из: {VALID_TYPES}")
    if status not in VALID_STATUSES:
        frappe.throw(f"status должен быть одним из: {VALID_STATUSES}")
    if not purpose or not purpose.strip():
        frappe.throw("Укажите назначение операции")
    amount = float(amount or 0)
    if amount <= 0:
        frappe.throw("Сумма должна быть больше нуля")

    if name and frappe.db.exists("Site Cash Entry", name):
        frappe.has_permission("Site Cash Entry", "write", doc=name, throw=True)
        doc = frappe.get_doc("Site Cash Entry", name)
        action = "updated"
    else:
        frappe.has_permission("Site Cash Entry", "create", throw=True)
        doc = frappe.new_doc("Site Cash Entry")
        action = "created"

    doc.project = project
    doc.entry_type = entry_type
    doc.operation_kind = operation_kind or "Прочее"
    doc.amount = amount
    doc.date = date or nowdate()
    doc.foreman = (foreman or "").strip()[:140]
    doc.counterparty = (counterparty or "").strip()[:140]
    doc.purpose = purpose.strip()[:140]
    doc.comment = (comment or "").strip()[:1000]
    doc.receipt_image_url = (receipt_image_url or "").strip()[:500]
    doc.status = status

    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name, "action": action}


@frappe.whitelist()
def confirm_entry(name: str) -> dict:
    """Подтверждает запись (доступно директору/бухгалтеру)."""
    frappe.has_permission("Site Cash Entry", "write", doc=name, throw=True)
    doc = frappe.get_doc("Site Cash Entry", name)
    if doc.status == "Подтверждён":
        return {"ok": True, "skipped": "already_confirmed"}
    doc.status = "Подтверждён"
    doc.confirmed_by = frappe.session.user
    doc.confirmed_at = now_datetime()
    doc.rejection_reason = ""
    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name, "confirmed_by": doc.confirmed_by}


@frappe.whitelist()
def reject_entry(name: str, reason: str = "") -> dict:
    """Отклоняет запись с причиной."""
    if not reason or not reason.strip():
        frappe.throw("Укажите причину отклонения")
    frappe.has_permission("Site Cash Entry", "write", doc=name, throw=True)
    doc = frappe.get_doc("Site Cash Entry", name)
    doc.status = "Отклонён"
    doc.rejection_reason = reason.strip()[:1000]
    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name}


@frappe.whitelist()
def delete_entry(name: str) -> dict:
    frappe.has_permission("Site Cash Entry", "delete", doc=name, throw=True)
    frappe.delete_doc("Site Cash Entry", name, ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist()
def get_summary(days: int = 90) -> dict:
    """Сводка по проектам: баланс + объём подтверждённых движений."""
    frappe.has_permission("Site Cash Entry", throw=True)

    by_project = frappe.db.sql("""
        SELECT project,
               SUM(CASE WHEN entry_type = 'Приход' AND status = 'Подтверждён' THEN amount ELSE 0 END) AS income,
               SUM(CASE WHEN entry_type = 'Расход' AND status = 'Подтверждён' THEN amount ELSE 0 END) AS outcome,
               SUM(CASE WHEN status = 'Ждёт подтверждения' THEN 1 ELSE 0 END) AS pending_count,
               COUNT(*) AS total_count
        FROM `tabSite Cash Entry`
        WHERE date >= %(s)s
        GROUP BY project
        ORDER BY pending_count DESC, outcome DESC
    """, {"s": add_days(nowdate(), -int(days))}, as_dict=True)

    for r in by_project:
        r["balance"] = float(r["income"] or 0) - float(r["outcome"] or 0)
        r["project_title"] = frappe.db.get_value("Construction Project", r["project"], "title") or r["project"]

    # KPI всего
    totals = frappe.db.sql("""
        SELECT
            SUM(CASE WHEN entry_type='Приход' AND status='Подтверждён' THEN amount ELSE 0 END) AS income_total,
            SUM(CASE WHEN entry_type='Расход' AND status='Подтверждён' THEN amount ELSE 0 END) AS outcome_total,
            SUM(CASE WHEN status='Ждёт подтверждения' THEN amount ELSE 0 END) AS pending_amount,
            COUNT(CASE WHEN status='Ждёт подтверждения' THEN 1 END) AS pending_count
        FROM `tabSite Cash Entry`
        WHERE date >= %(s)s
    """, {"s": add_days(nowdate(), -int(days))}, as_dict=True)[0]

    return {
        "by_project": by_project,
        "totals": {
            "income": float(totals["income_total"] or 0),
            "outcome": float(totals["outcome_total"] or 0),
            "balance": float(totals["income_total"] or 0) - float(totals["outcome_total"] or 0),
            "pending_amount": float(totals["pending_amount"] or 0),
            "pending_count": int(totals["pending_count"] or 0),
        },
        "period_days": int(days),
    }


@frappe.whitelist()
def get_project_balance(project: str, days: int = 365) -> dict:
    """Баланс кассы по конкретному проекту с разбивкой по видам операций."""
    frappe.has_permission("Site Cash Entry", throw=True)
    if not frappe.db.exists("Construction Project", project):
        frappe.throw(f"Проект {project} не найден")

    by_kind = frappe.db.sql("""
        SELECT operation_kind, entry_type, SUM(amount) AS total, COUNT(*) AS cnt
        FROM `tabSite Cash Entry`
        WHERE project = %(p)s AND status = 'Подтверждён'
              AND date >= %(s)s
        GROUP BY operation_kind, entry_type
        ORDER BY total DESC
    """, {"p": project, "s": add_days(nowdate(), -int(days))}, as_dict=True)

    income = sum(float(r["total"]) for r in by_kind if r["entry_type"] == "Приход")
    outcome = sum(float(r["total"]) for r in by_kind if r["entry_type"] == "Расход")

    return {
        "project": project,
        "balance": income - outcome,
        "income": income,
        "outcome": outcome,
        "by_kind": by_kind,
    }
