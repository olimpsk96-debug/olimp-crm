"""Webhook для приёма заявок с сайта/лендинга.

Не требует Frappe-логина (allow_guest=True), защищён опциональным секретом.

Использование с сайта (форма):
    <form action="http://erp.olimp-ural.ru/api/method/olimp_construction.api.webhook.leads.create_lead"
          method="POST">
        <input name="name" placeholder="Ваше имя" required>
        <input name="phone" placeholder="+7..." required>
        <input name="email" type="email">
        <input name="company" placeholder="Компания">
        <input name="subject" placeholder="Тема обращения">
        <textarea name="description" placeholder="Опишите задачу"></textarea>
        <input name="utm_source" type="hidden" value="olimp-ural.ru">
        <!-- Honeypot для ботов: реальные пользователи не заполняют -->
        <input name="website" type="text" style="display:none" tabindex="-1">
        <input name="secret" type="hidden" value="<WEBHOOK_SECRET>">
        <button>Отправить</button>
    </form>

Также можно слать JSON через fetch:
    fetch('http://erp.olimp-ural.ru/api/method/olimp_construction.api.webhook.leads.create_lead',
          {method:'POST', headers:{'Content-Type':'application/json'},
           body: JSON.stringify({name,phone,email,company,subject,description})})
"""
from __future__ import annotations

import os
import re

import frappe
from frappe.utils import now_datetime

from olimp_construction.telegram_utils import send_message


def _strip(s) -> str:
    return (s or "").strip()[:500] if s else ""


def _normalize_phone(phone: str) -> str:
    """Приводит к формату +79991234567 (только цифры с +)."""
    if not phone:
        return ""
    digits = re.sub(r"[^\d+]", "", phone)
    # Если начинается с 8 — заменяем на +7
    if digits.startswith("8") and len(digits) == 11:
        digits = "+7" + digits[1:]
    if digits.startswith("7") and len(digits) == 11:
        digits = "+" + digits
    return digits[:20]


def _validate_email(email: str) -> str:
    if not email:
        return ""
    email = email.strip().lower()[:140]
    if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return email
    return ""


def _get_or_create_customer(company: str, contact_name: str, source: str) -> str:
    """Находит Customer по customer_name или создаёт нового."""
    name = _strip(company) or _strip(contact_name) or "Физлицо"
    name = name[:140]

    existing = frappe.db.exists("Customer", {"customer_name": name})
    if existing:
        return existing

    # Берём НЕ-групповые значения (ERPNext запрещает is_group=1 для назначения клиенту)
    territory = (
        frappe.db.get_value("Territory", {"is_group": 0}, "name")
        or frappe.db.get_value("Territory", {}, "name")
        or "All Territories"
    )
    group = (
        frappe.db.get_value("Customer Group", {"is_group": 0}, "name")
        or frappe.db.get_value("Customer Group", {}, "name")
        or "Commercial"
    )

    doc = frappe.get_doc({
        "doctype": "Customer",
        "customer_name": name,
        "customer_type": "Company" if company else "Individual",
        "territory": territory,
        "customer_group": group,
    })
    doc.insert(ignore_permissions=True)
    return doc.name


@frappe.whitelist(allow_guest=True, methods=["POST"])
def create_lead(
    name: str = "",
    phone: str = "",
    email: str = "",
    company: str = "",
    subject: str = "",
    description: str = "",
    source: str = "Сайт",
    utm_source: str = "",
    utm_medium: str = "",
    utm_campaign: str = "",
    website: str = "",  # honeypot — должен быть пустым
    secret: str = "",
) -> dict:
    """Создаёт Deal со статусом 'Лид'. Защита: honeypot + опц. secret.

    Возвращает {ok, deal, customer, message} или {error}.
    """
    # 1) Honeypot — если бот заполнил скрытое поле «website», отбрасываем
    if website:
        return {"ok": True, "skipped": "spam"}  # не палим что это honeypot

    # 2) Опциональный shared secret (если задан WEBHOOK_LEAD_SECRET в .env)
    expected_secret = os.getenv("WEBHOOK_LEAD_SECRET", "").strip()
    if expected_secret and secret != expected_secret:
        frappe.throw("Invalid secret", frappe.PermissionError)

    # 3) Валидация обязательных полей — должно быть хоть что-то для связи
    name = _strip(name)
    phone_norm = _normalize_phone(phone)
    email_norm = _validate_email(email)
    company_norm = _strip(company)
    subject_norm = _strip(subject) or "Заявка с сайта"
    description_norm = _strip(description)

    if not (phone_norm or email_norm):
        frappe.throw("Укажите телефон или email")

    # 4) Customer
    customer_name = _get_or_create_customer(company_norm, name, source)

    # Сохраним телефон/email в Customer.mobile_no/email_id если ещё пусто
    cust = frappe.get_doc("Customer", customer_name)
    updated = False
    if phone_norm and not cust.get("mobile_no"):
        cust.mobile_no = phone_norm
        updated = True
    if email_norm and not cust.get("email_id"):
        cust.email_id = email_norm
        updated = True
    if updated:
        cust.save(ignore_permissions=True)

    # 5) Deal
    deal_title = subject_norm[:140]
    deal_desc = description_norm or ""
    if utm_source or utm_medium or utm_campaign:
        deal_desc += f"\n\nUTM: source={utm_source}, medium={utm_medium}, campaign={utm_campaign}"

    deal = frappe.get_doc({
        "doctype": "Deal",
        "title": deal_title,
        "customer": customer_name,
        "contact_name": name,
        "status": "Лид",
        "source": source if source in ("Сайт", "Рекомендация", "Тендер", "Холодный звонок", "Знакомство", "Прочее") else "Сайт",
        "description": deal_desc[:5000],
        "notes": f"Телефон: {phone_norm}\nEmail: {email_norm}\nКомпания: {company_norm}\nДата: {now_datetime()}"[:5000],
    })
    deal.insert(ignore_permissions=True)
    frappe.db.commit()

    # 6) Telegram-уведомление директору
    try:
        msg = (
            f"🆕 <b>Новая заявка с {source}</b>\n\n"
            f"<b>{deal_title}</b>\n"
            f"👤 {name or '—'}\n"
            f"🏢 {company_norm or '—'}\n"
            f"📱 {phone_norm or '—'}\n"
            f"📧 {email_norm or '—'}\n\n"
        )
        if description_norm:
            msg += f"<i>{description_norm[:400]}</i>\n\n"
        msg += f"<a href='http://erp.olimp-ural.ru/app/deal/{deal.name}'>Открыть в CRM →</a>"
        send_message(msg)
    except Exception as e:
        frappe.logger().warning(f"Telegram-уведомление не отправлено: {e}")

    return {
        "ok": True,
        "deal": deal.name,
        "customer": customer_name,
        "message": "Заявка принята, мы свяжемся с вами в ближайшее время",
    }


@frappe.whitelist()
def get_lead_stats(days: int = 30) -> dict:
    """Статистика лидов с сайта за период (по source)."""
    frappe.has_permission("Deal", throw=True)
    days = max(1, min(int(days), 365))

    rows = frappe.db.sql(
        """SELECT source,
                  COUNT(*) AS total,
                  SUM(CASE WHEN status = 'Лид' THEN 1 ELSE 0 END) AS new_count,
                  SUM(CASE WHEN status IN ('Договор','В работе','Закрыт выигран') THEN 1 ELSE 0 END) AS won,
                  SUM(CASE WHEN status = 'Закрыт проигран' THEN 1 ELSE 0 END) AS lost
           FROM `tabDeal`
           WHERE creation >= DATE_SUB(NOW(), INTERVAL %(d)s DAY)
           GROUP BY source
           ORDER BY total DESC""",
        {"d": days}, as_dict=True,
    )

    return {
        "period_days": days,
        "by_source": rows,
        "total": sum(r["total"] for r in rows),
    }
