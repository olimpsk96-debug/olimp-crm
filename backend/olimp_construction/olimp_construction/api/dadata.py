"""Интеграция с DaData.ru — поиск компании по ИНН/ОГРН/названию.

DaData бесплатный план: 10 000 запросов/день, не требует подтверждения для базовых API.
Ключ берётся из .env: DADATA_API_KEY (формат: токен, не "Token ...").

API: https://dadata.ru/api/find-party/
Получить ключ: https://dadata.ru/profile/#info (бесплатная регистрация)
"""
from __future__ import annotations

import json
import os

import frappe
import requests


DADATA_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party"


@frappe.whitelist()
def lookup_by_inn(inn: str) -> dict:
    """Поиск компании в ЕГРЮЛ/ЕГРИП по ИНН.

    Возвращает структурированные данные: название, ОГРН, адрес, директор, статус.
    """
    if not inn or not inn.strip():
        frappe.throw("Укажи ИНН")

    inn = inn.strip()
    if not inn.isdigit() or len(inn) not in (10, 12):
        frappe.throw("ИНН должен быть 10 (юрлицо) или 12 (ИП) цифр")

    api_key = os.getenv("DADATA_API_KEY", "").strip()
    if not api_key:
        frappe.throw(
            "DADATA_API_KEY не задан в .env. "
            "Зарегистрируйся бесплатно на https://dadata.ru/profile/ "
            "и добавь ключ в .env. Лимит 10 000 запросов/день бесплатно."
        )

    try:
        r = requests.post(
            DADATA_URL,
            json={"query": inn, "type": "LEGAL" if len(inn) == 10 else "INDIVIDUAL"},
            headers={
                "Authorization": f"Token {api_key}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=8,
        )
        r.raise_for_status()
    except requests.HTTPError as e:
        frappe.throw(f"DaData ошибка {e.response.status_code}: {e.response.text[:200]}")
    except requests.RequestException as e:
        frappe.throw(f"DaData недоступен: {str(e)[:200]}")

    data = r.json()
    suggestions = data.get("suggestions") or []
    if not suggestions:
        return {"ok": False, "message": "Компания с таким ИНН не найдена"}

    s = suggestions[0]
    info = s.get("data") or {}
    name = info.get("name") or {}
    address = info.get("address") or {}
    management = info.get("management") or {}

    return {
        "ok": True,
        "inn": info.get("inn"),
        "kpp": info.get("kpp"),
        "ogrn": info.get("ogrn"),
        "type": info.get("type"),  # LEGAL / INDIVIDUAL
        "name_full": name.get("full_with_opf") or s.get("value"),
        "name_short": name.get("short_with_opf"),
        "value": s.get("value"),
        "okved": info.get("okved"),
        "okved_type": info.get("okved_type"),
        "address_value": address.get("value"),
        "address_unrestricted": address.get("unrestricted_value"),
        "manager_name": management.get("name"),
        "manager_post": management.get("post"),
        "state": (info.get("state") or {}).get("status"),
        "state_actuality_date": (info.get("state") or {}).get("actuality_date"),
        "registration_date": (info.get("state") or {}).get("registration_date"),
        "liquidation_date": (info.get("state") or {}).get("liquidation_date"),
        "branch_type": info.get("branch_type"),
        "employee_count": info.get("employee_count"),
    }


@frappe.whitelist()
def lookup_and_apply_to_customer(inn: str, customer_name: str | None = None) -> dict:
    """Найти компанию + создать/обновить Customer.

    Если customer_name задан — обновляем существующего.
    Иначе создаём нового на основе ИНН.
    """
    lookup = lookup_by_inn(inn)
    if not lookup.get("ok"):
        return lookup

    target_name = customer_name or lookup["name_short"] or lookup["name_full"]
    if not target_name:
        frappe.throw("Не удалось определить название компании")

    target_name = target_name[:140]
    existing = frappe.db.exists("Customer", target_name)

    # Не-групповые territory + customer_group
    default_territory = frappe.db.get_value("Territory", {"is_group": 0}, "name") or "All Territories"
    default_group = frappe.db.get_value("Customer Group", {"is_group": 0}, "name") or "Commercial"

    payload = {
        "customer_type": "Individual" if lookup.get("type") == "INDIVIDUAL" else "Company",
        "tax_id": lookup.get("inn"),
    }

    if existing:
        frappe.has_permission("Customer", "write", doc=existing, throw=True)
        doc = frappe.get_doc("Customer", existing)
        if not doc.tax_id:
            doc.tax_id = lookup.get("inn")
        if not doc.get("customer_details"):
            doc.customer_details = _build_details_text(lookup)
        doc.save(ignore_permissions=True)
        action = "updated"
    else:
        frappe.has_permission("Customer", "create", throw=True)
        doc = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": target_name,
            "customer_type": payload["customer_type"],
            "territory": default_territory,
            "customer_group": default_group,
            "tax_id": lookup.get("inn"),
            "customer_details": _build_details_text(lookup),
        })
        doc.insert(ignore_permissions=True)
        action = "created"

    frappe.db.commit()
    return {
        "ok": True,
        "action": action,
        "customer": doc.name,
        "lookup": lookup,
    }


def _build_details_text(lookup: dict) -> str:
    """Форматирует детали из DaData в текст для customer_details."""
    parts = []
    if lookup.get("name_full"):
        parts.append(f"Полное наименование: {lookup['name_full']}")
    for k, label in [
        ("inn", "ИНН"), ("kpp", "КПП"), ("ogrn", "ОГРН"),
        ("address_value", "Адрес"),
        ("manager_post", "Руководитель — должность"),
        ("manager_name", "Руководитель — ФИО"),
        ("okved", "ОКВЭД"),
        ("state", "Статус"),
        ("registration_date", "Зарегистрирована"),
    ]:
        v = lookup.get(k)
        if v:
            parts.append(f"{label}: {v}")
    return "\n".join(parts)[:2000]
