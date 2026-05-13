"""Хуки install / after_migrate для приложения olimp_construction."""
from __future__ import annotations

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def sync_custom_fields() -> None:
    """Создаёт/обновляет Custom Field'ы, объявленные в hooks.py.

    Идемпотентна: повторный вызов безопасен — существующие поля обновляются,
    отсутствующие создаются.
    """
    from olimp_construction.hooks import custom_fields

    if not custom_fields:
        return

    # Фильтруем только DocType'ы, реально существующие в БД, чтобы не падать
    filtered = {
        doctype: fields
        for doctype, fields in custom_fields.items()
        if frappe.db.exists("DocType", doctype)
    }

    if filtered:
        create_custom_fields(filtered, ignore_validate=True)
        frappe.logger().info(
            f"olimp_construction.sync_custom_fields: applied to {list(filtered.keys())}"
        )
