"""API аттестаций сотрудников + бизнес-логика напоминаний.

DocType `Employee Certification` — удостоверения (работы на высоте, электробезопасность и т.п.)
со сроком действия. При истечении за 30 дней — алерт в Telegram.
"""
from __future__ import annotations

from datetime import timedelta

import frappe
from frappe.utils import getdate, nowdate

from olimp_construction.telegram_utils import send_message


@frappe.whitelist()
def get_list(status: str | None = None, cert_type: str | None = None) -> list[dict]:
    """Список аттестаций с фильтрами."""
    frappe.has_permission("Employee Certification", throw=True)
    filters: dict = {}
    if status:
        filters["status"] = status
    if cert_type:
        filters["cert_type"] = cert_type

    rows = frappe.get_all(
        "Employee Certification",
        filters=filters,
        fields=[
            "name", "title", "employee_name", "employee_role", "user",
            "cert_type", "cert_number", "issuing_organization",
            "issue_date", "expiry_date", "status", "notes",
        ],
        order_by="expiry_date asc",
        limit=500,
    )

    today = getdate(nowdate())
    for r in rows:
        if r.get("expiry_date"):
            r["days_to_expiry"] = (getdate(r["expiry_date"]) - today).days
        else:
            r["days_to_expiry"] = None
    return rows


@frappe.whitelist()
def get_stats() -> dict:
    """Сводка: всего, действует, скоро истекает, просрочено."""
    frappe.has_permission("Employee Certification", throw=True)
    total = frappe.db.count("Employee Certification", {"status": ["!=", "Архив"]})
    valid = frappe.db.count("Employee Certification", {"status": "Действует"})
    expiring = frappe.db.count("Employee Certification", {"status": "Истекает скоро"})
    expired = frappe.db.count("Employee Certification", {"status": "Просрочено"})

    # Топ-5 ближайших к истечению
    today = getdate(nowdate())
    expiring_soon = frappe.get_all(
        "Employee Certification",
        filters={"status": ["in", ["Действует", "Истекает скоро"]]},
        fields=["name", "title", "employee_name", "cert_type", "expiry_date"],
        order_by="expiry_date asc",
        limit=5,
    )
    for e in expiring_soon:
        e["days_to_expiry"] = (getdate(e["expiry_date"]) - today).days if e.get("expiry_date") else None

    return {
        "total": total,
        "valid": valid,
        "expiring": expiring,
        "expired": expired,
        "expiring_soon": expiring_soon,
    }


@frappe.whitelist()
def save_certification(data: dict) -> dict:
    """Создать или обновить аттестацию."""
    frappe.has_permission("Employee Certification", "create", throw=True)
    name = data.get("name")
    if name and frappe.db.exists("Employee Certification", name):
        doc = frappe.get_doc("Employee Certification", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"updated": doc.name}

    doc = frappe.get_doc({"doctype": "Employee Certification", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"created": doc.name}


@frappe.whitelist()
def archive(name: str) -> dict:
    """Архивировать аттестацию (например, после получения новой взамен)."""
    frappe.has_permission("Employee Certification", "write", throw=True)
    frappe.db.set_value("Employee Certification", name, "status", "Архив", update_modified=False)
    frappe.db.commit()
    return {"ok": True, "name": name}


def check_certification_expiry() -> None:
    """Daily cron: пересчитывает статусы + отправляет Telegram-алерт за 30/14/7 дней.

    Также раз в неделю напоминает по уже просроченным.
    """
    try:
        today = getdate(nowdate())

        # 1. Пересчёт статусов всех неархивных
        all_certs = frappe.get_all(
            "Employee Certification",
            filters={"status": ["!=", "Архив"]},
            fields=["name", "title", "employee_name", "cert_type", "expiry_date", "status", "next_reminder_sent"],
        )

        expiring_in_30 = []
        expiring_in_7 = []
        expired = []

        for c in all_certs:
            if not c.get("expiry_date"):
                continue
            days_left = (getdate(c["expiry_date"]) - today).days

            # Авто-обновление статуса
            new_status = "Действует"
            if days_left < 0:
                new_status = "Просрочено"
            elif days_left <= 30:
                new_status = "Истекает скоро"

            if new_status != c["status"]:
                frappe.db.set_value("Employee Certification", c["name"], "status",
                                    new_status, update_modified=False)

            # Не отправлять повторно если уже было напоминание сегодня
            last_reminder = c.get("next_reminder_sent")
            if last_reminder and getdate(last_reminder) >= today:
                continue

            if days_left < 0:
                # Просрочено — пинг раз в неделю
                if not last_reminder or (today - getdate(last_reminder)).days >= 7:
                    expired.append(c)
                    frappe.db.set_value("Employee Certification", c["name"],
                                        "next_reminder_sent", str(today), update_modified=False)
            elif days_left == 7 or days_left == 14 or days_left == 30:
                if days_left == 7:
                    expiring_in_7.append(c)
                else:
                    expiring_in_30.append(c)
                frappe.db.set_value("Employee Certification", c["name"],
                                    "next_reminder_sent", str(today), update_modified=False)

        frappe.db.commit()

        # 2. Telegram-сводка
        if not (expired or expiring_in_30 or expiring_in_7):
            frappe.logger().info("Certification check: no alerts today")
            return

        lines = []
        if expired:
            lines.append(f"🔴 <b>Просроченные аттестации ({len(expired)})</b>")
            for c in expired[:10]:
                days_overdue = (today - getdate(c["expiry_date"])).days
                lines.append(f"• {c['employee_name']} — {c['cert_type']} (просроч. {days_overdue}д)")

        if expiring_in_7:
            if lines:
                lines.append("")
            lines.append(f"🟡 <b>Истекают через 7 дней ({len(expiring_in_7)})</b>")
            for c in expiring_in_7[:10]:
                lines.append(f"• {c['employee_name']} — {c['cert_type']} (до {c['expiry_date']})")

        if expiring_in_30:
            if lines:
                lines.append("")
            lines.append(f"🔔 <b>Истекают в течение месяца ({len(expiring_in_30)})</b>")
            for c in expiring_in_30[:10]:
                days_left = (getdate(c["expiry_date"]) - today).days
                lines.append(f"• {c['employee_name']} — {c['cert_type']} (через {days_left}д)")

        text = "\n".join(lines)
        sent = send_message(text)
        frappe.logger().info(
            f"Certification alerts: {len(expired)} просроч., {len(expiring_in_7)} через 7д, "
            f"{len(expiring_in_30)} через 30д — {'отправлено' if sent else 'не отправлено'}"
        )

    except Exception:
        frappe.log_error(frappe.get_traceback(), "check_certification_expiry")
