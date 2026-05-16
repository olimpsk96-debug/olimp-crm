"""OCE / OLIMP.STACK integration: добавление Custom Fields к существующим DocType.

Скрипт повторно вызываемый — добавляет OCE-поля к Construction Project, Task,
Project Risk, Change Order. Источник: docs/OLIMP_STACK_PLAN.md.

Вызов из bench console:
    from olimp_construction.install_oce import sync_oce_fields
    sync_oce_fields()
"""
from __future__ import annotations

import frappe


OCE_CUSTOM_FIELDS: dict[str, list[dict]] = {
    "Construction Project": [
        {"fieldname": "section_oce_integration", "fieldtype": "Section Break",
         "label": "OCE Integration (внешняя смета)", "collapsible": 1,
         "insert_after": "notes"},
        {"fieldname": "oce_project_id", "fieldtype": "Data",
         "label": "OCE Project ID", "read_only": 1,
         "insert_after": "section_oce_integration"},
        {"fieldname": "oce_boq_id", "fieldtype": "Link",
         "label": "Активная BOQ", "options": "BOQ",
         "insert_after": "oce_project_id"},
        {"fieldname": "oce_boq_version", "fieldtype": "Int",
         "label": "Версия BOQ", "insert_after": "oce_boq_id"},
        {"fieldname": "oce_column_break", "fieldtype": "Column Break",
         "insert_after": "oce_boq_version"},
        {"fieldname": "oce_spi", "fieldtype": "Float",
         "label": "SPI (Schedule Performance)", "read_only": 1, "precision": "2",
         "insert_after": "oce_column_break"},
        {"fieldname": "oce_cpi", "fieldtype": "Float",
         "label": "CPI (Cost Performance)", "read_only": 1, "precision": "2",
         "insert_after": "oce_spi"},
        {"fieldname": "oce_eac", "fieldtype": "Currency",
         "label": "EAC (Прогноз стоимости)", "read_only": 1,
         "insert_after": "oce_cpi"},
        {"fieldname": "oce_last_sync", "fieldtype": "Datetime",
         "label": "Последняя синхр.", "read_only": 1,
         "insert_after": "oce_eac"},
    ],
    "Task": [
        {"fieldname": "section_oce_task", "fieldtype": "Section Break",
         "label": "OCE Integration", "collapsible": 1, "insert_after": "description"},
        {"fieldname": "oce_activity_id", "fieldtype": "Data",
         "label": "OCE Activity ID", "read_only": 1,
         "insert_after": "section_oce_task"},
        {"fieldname": "dependency_type", "fieldtype": "Select",
         "label": "Тип зависимости",
         "options": "FS\nFF\nSS\nSF", "default": "FS",
         "insert_after": "oce_activity_id"},
        {"fieldname": "lag_days", "fieldtype": "Int", "label": "Lag, дн.",
         "insert_after": "dependency_type"},
        {"fieldname": "oce_task_column_break", "fieldtype": "Column Break",
         "insert_after": "lag_days"},
        {"fieldname": "is_critical_path", "fieldtype": "Check",
         "label": "Критический путь", "read_only": 1,
         "insert_after": "oce_task_column_break"},
        {"fieldname": "baseline_start", "fieldtype": "Date", "label": "Baseline start",
         "insert_after": "is_critical_path"},
        {"fieldname": "baseline_end", "fieldtype": "Date", "label": "Baseline end",
         "insert_after": "baseline_start"},
        {"fieldname": "earned_value", "fieldtype": "Currency",
         "label": "Earned Value", "read_only": 1, "insert_after": "baseline_end"},
    ],
    "Project Risk": [
        {"fieldname": "section_oce_risk", "fieldtype": "Section Break",
         "label": "OCE / Monte Carlo", "collapsible": 1, "insert_after": "notes"},
        {"fieldname": "probability_value", "fieldtype": "Percent",
         "label": "Численная вероятность (Monte Carlo)",
         "description": "0-100. Если не указано — конвертируется из Low/Med/High",
         "insert_after": "section_oce_risk"},
        {"fieldname": "impact_cost_min", "fieldtype": "Currency",
         "label": "Мин. удорожание ₽", "insert_after": "probability_value"},
        {"fieldname": "impact_cost_max", "fieldtype": "Currency",
         "label": "Макс. удорожание ₽", "insert_after": "impact_cost_min"},
        {"fieldname": "oce_risk_column_break", "fieldtype": "Column Break",
         "insert_after": "impact_cost_max"},
        {"fieldname": "impact_days_min", "fieldtype": "Int",
         "label": "Мин. задержка дн.", "insert_after": "oce_risk_column_break"},
        {"fieldname": "impact_days_likely", "fieldtype": "Int",
         "label": "Вероятная задержка дн.", "insert_after": "impact_days_min"},
        {"fieldname": "impact_days_max", "fieldtype": "Int",
         "label": "Макс. задержка дн.", "insert_after": "impact_days_likely"},
        {"fieldname": "monte_carlo_p80", "fieldtype": "Currency",
         "label": "P80 (Monte Carlo)", "read_only": 1,
         "description": "80-й перцентиль из симуляции",
         "insert_after": "impact_days_max"},
        {"fieldname": "oce_risk_id", "fieldtype": "Data",
         "label": "OCE Risk ID", "read_only": 1,
         "insert_after": "monte_carlo_p80"},
    ],
    "Change Order": [
        {"fieldname": "section_oce_co", "fieldtype": "Section Break",
         "label": "OCE Integration", "collapsible": 1, "insert_after": "notes"},
        {"fieldname": "doc_link_minio", "fieldtype": "Data",
         "label": "PDF ДС (URL)", "options": "URL",
         "insert_after": "section_oce_co"},
        {"fieldname": "oce_change_order_id", "fieldtype": "Data",
         "label": "OCE Change Order ID", "read_only": 1,
         "insert_after": "doc_link_minio"},
    ],
}


def sync_oce_fields() -> dict:
    """Добавляет/обновляет OCE-поля. Идемпотентно."""
    from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
    create_custom_fields(OCE_CUSTOM_FIELDS, update=True)
    frappe.db.commit()
    total = sum(len(v) for v in OCE_CUSTOM_FIELDS.values())
    return {
        "ok": True,
        "total_fields": total,
        "doctypes": list(OCE_CUSTOM_FIELDS.keys()),
    }
