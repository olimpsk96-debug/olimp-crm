"""API для Tender Guarantee (44-ФЗ / 223-ФЗ обеспечения).

Идея из СБИС Госзакупки + Tenderok: трекать обеспечение заявки,
обеспечение контракта, банковские гарантии и СРО взносы по тендерам со
сроками истечения и Telegram-алертами за 30/7/1 день.
"""
from __future__ import annotations

from datetime import timedelta

import frappe
from frappe.utils import add_days, flt, getdate, nowdate


VALID_TYPES = (
    "Обеспечение заявки",
    "Обеспечение контракта",
    "Банковская гарантия",
    "СРО взнос",
    "Гарантийные обязательства",
)
VALID_STATUSES = (
    "Активна", "Истекла", "Возвращена", "Использована", "Аннулирована",
)


@frappe.whitelist()
def list_guarantees(tender: str | None = None, status: str | None = None,
                    guarantee_type: str | None = None,
                    only_active: int = 0, limit: int = 200) -> list[dict]:
    frappe.has_permission("Tender Guarantee", throw=True)

    filters: dict = {}
    if tender:
        filters["tender"] = tender
    if status:
        filters["status"] = status
    if guarantee_type:
        filters["guarantee_type"] = guarantee_type
    if int(only_active or 0):
        filters["status"] = "Активна"

    rows = frappe.get_all(
        "Tender Guarantee",
        filters=filters,
        fields=["name", "tender", "guarantee_type", "guarantee_number",
                "amount", "issue_date", "expiry_date", "status",
                "bank_name", "commission_pct", "commission_amount",
                "notes", "owner", "creation", "modified"],
        order_by="expiry_date ASC, creation DESC",
        limit_page_length=int(limit),
    )

    today_d = getdate()
    for r in rows:
        # Подтянем title тендера
        tinfo = frappe.db.get_value("Tender", r["tender"],
                                     ["title", "status", "tender_law"], as_dict=True)
        if tinfo:
            r["tender_title"] = tinfo.get("title") or r["tender"]
            r["tender_status"] = tinfo.get("status")
            r["tender_law"] = tinfo.get("tender_law")

        if r["expiry_date"]:
            exp = getdate(r["expiry_date"])
            r["days_to_expiry"] = (exp - today_d).days
        else:
            r["days_to_expiry"] = None

    return rows


@frappe.whitelist()
def save_guarantee(name: str | None = None, tender: str = "",
                   guarantee_type: str = "Обеспечение заявки",
                   guarantee_number: str = "", amount: float = 0,
                   issue_date: str | None = None, expiry_date: str | None = None,
                   status: str = "Активна",
                   bank_name: str = "", commission_pct: float = 0,
                   commission_amount: float = 0,
                   notes: str = "") -> dict:
    if not tender:
        frappe.throw("tender обязателен")
    if guarantee_type not in VALID_TYPES:
        frappe.throw(f"guarantee_type must be one of {VALID_TYPES}")
    if status not in VALID_STATUSES:
        frappe.throw(f"status must be one of {VALID_STATUSES}")
    if not frappe.db.exists("Tender", tender):
        frappe.throw(f"Тендер {tender} не найден")
    if float(amount or 0) <= 0:
        frappe.throw("amount должен быть > 0")
    if not expiry_date:
        frappe.throw("expiry_date обязателен")

    if name and frappe.db.exists("Tender Guarantee", name):
        frappe.has_permission("Tender Guarantee", "write", doc=name, throw=True)
        doc = frappe.get_doc("Tender Guarantee", name)
        action = "updated"
    else:
        frappe.has_permission("Tender Guarantee", "create", throw=True)
        doc = frappe.new_doc("Tender Guarantee")
        action = "created"

    doc.tender = tender
    doc.guarantee_type = guarantee_type
    doc.guarantee_number = (guarantee_number or "").strip()[:140]
    doc.amount = float(amount)
    doc.issue_date = issue_date or nowdate()
    doc.expiry_date = expiry_date
    doc.status = status
    doc.bank_name = (bank_name or "").strip()[:140]
    doc.commission_pct = float(commission_pct or 0)
    doc.commission_amount = float(commission_amount or 0)
    # Если БГ и есть % но нет суммы — пересчитаем
    if guarantee_type == "Банковская гарантия" and doc.commission_pct and not doc.commission_amount:
        doc.commission_amount = doc.amount * doc.commission_pct / 100
    doc.notes = (notes or "").strip()[:1000]

    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name, "action": action}


@frappe.whitelist()
def delete_guarantee(name: str) -> dict:
    frappe.has_permission("Tender Guarantee", "delete", doc=name, throw=True)
    frappe.delete_doc("Tender Guarantee", name, ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist()
def get_summary() -> dict:
    """Сводка по активным гарантиям: сумма заморожено + ближайшие истечения."""
    frappe.has_permission("Tender Guarantee", throw=True)
    today_d = getdate()

    active = frappe.db.sql("""
        SELECT guarantee_type, status,
               COUNT(*) AS cnt,
               COALESCE(SUM(amount), 0) AS total_amount,
               COALESCE(SUM(commission_amount), 0) AS total_commission
        FROM `tabTender Guarantee`
        WHERE status = 'Активна'
        GROUP BY guarantee_type, status
    """, as_dict=True)

    by_type: dict = {t: {"count": 0, "amount": 0, "commission": 0} for t in VALID_TYPES}
    total_amount = total_commission = 0.0
    for r in active:
        by_type[r["guarantee_type"]] = {
            "count": int(r["cnt"]),
            "amount": float(r["total_amount"] or 0),
            "commission": float(r["total_commission"] or 0),
        }
        total_amount += float(r["total_amount"] or 0)
        total_commission += float(r["total_commission"] or 0)

    # Истекающие в ближайшие 30 дней
    expiring = frappe.db.sql("""
        SELECT g.name, g.tender, g.guarantee_type, g.guarantee_number,
               g.amount, g.expiry_date, g.bank_name,
               DATEDIFF(g.expiry_date, %(today)s) AS days_left
        FROM `tabTender Guarantee` g
        WHERE g.status = 'Активна'
          AND g.expiry_date IS NOT NULL
          AND g.expiry_date BETWEEN %(today)s AND %(in30)s
        ORDER BY g.expiry_date ASC
        LIMIT 30
    """, {"today": str(today_d), "in30": str(today_d + timedelta(days=30))}, as_dict=True)

    for e in expiring:
        e["tender_title"] = frappe.db.get_value("Tender", e["tender"], "title") or e["tender"]

    return {
        "by_type": by_type,
        "totals": {
            "amount_frozen": total_amount,
            "commission_paid": total_commission,
            "active_count": sum(v["count"] for v in by_type.values()),
        },
        "expiring_30d": expiring,
    }


def check_guarantee_expiry() -> dict | None:
    """Daily cron: алерт об истечении за 30/7/1 день. Защита от спама через
    next_reminder_sent (не чаще раза в 7 дней)."""
    try:
        if not frappe.db.exists("DocType", "Tender Guarantee"):
            return None

        from olimp_construction.telegram_utils import send_message

        today_d = getdate()
        cutoff_spam = add_days(today_d, -7)

        items = frappe.db.sql("""
            SELECT name, tender, guarantee_type, guarantee_number,
                   amount, expiry_date, bank_name, next_reminder_sent,
                   DATEDIFF(expiry_date, %(today)s) AS days_left
            FROM `tabTender Guarantee`
            WHERE status = 'Активна'
              AND expiry_date IS NOT NULL
              AND DATEDIFF(expiry_date, %(today)s) IN (30, 14, 7, 3, 1)
              AND (next_reminder_sent IS NULL OR next_reminder_sent <= %(cutoff)s)
            ORDER BY expiry_date ASC
        """, {"today": str(today_d), "cutoff": str(cutoff_spam)}, as_dict=True)

        if not items:
            return {"ok": True, "alerted": 0}

        # Авто-переводим в «Истекла» те, где days_left < 0
        expired_now = frappe.db.sql("""
            SELECT name FROM `tabTender Guarantee`
            WHERE status = 'Активна' AND expiry_date < %(today)s
        """, {"today": str(today_d)}, pluck="name")
        for n in expired_now:
            frappe.db.set_value("Tender Guarantee", n, "status", "Истекла",
                                update_modified=False)
        if expired_now:
            frappe.db.commit()

        lines = [f"⏰ <b>Истекают обеспечения тендеров ({len(items)})</b>", ""]
        for i in items[:20]:
            tender_title = frappe.db.get_value("Tender", i["tender"], "title") or i["tender"]
            d = i["days_left"]
            mark = "🔴" if d <= 1 else ("🟠" if d <= 7 else "🟡")
            bank = f" · {i['bank_name']}" if i['bank_name'] else ""
            lines.append(
                f"• {mark} {i['guarantee_type']} {i.get('guarantee_number') or ''}{bank}: "
                f"{int(i['amount']):,} ₽ — истекает {i['expiry_date']} ({d} дн.) "
                f"→ {tender_title}".replace(",", " ")
            )

        if len(items) > 20:
            lines.append(f"\n…и ещё {len(items) - 20}")

        sent = send_message("\n".join(lines))

        # Обновим next_reminder_sent
        if sent:
            for i in items:
                frappe.db.set_value("Tender Guarantee", i["name"],
                                    "next_reminder_sent", str(today_d),
                                    update_modified=False)
            frappe.db.commit()

        frappe.logger().info(
            f"check_guarantee_expiry: alerted {len(items)}, expired now={len(expired_now)}, "
            f"sent={'yes' if sent else 'no'}"
        )
        return {"ok": True, "alerted": len(items), "expired_now": len(expired_now), "sent": sent}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "check_guarantee_expiry")
        return None
