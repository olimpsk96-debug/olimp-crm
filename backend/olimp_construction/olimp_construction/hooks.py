from __future__ import annotations

app_name = "olimp_construction"
app_title = "Олимп Строительство"
app_publisher = "ООО Олимп"
app_description = "ERP/CRM модуль для промышленного строительства"
app_email = "erp@olimp-ural.ru"
app_license = "Proprietary"

# DocType классы
override_doctype_class: dict[str, str] = {}

# Custom fields (добавляются к стандартным DocType)
custom_fields: dict[str, list[dict]] = {
    "Project": [
        {
            "fieldname": "olimp_section",
            "label": "Олимп",
            "fieldtype": "Section Break",
            "insert_after": "project_type",
        },
        {
            "fieldname": "object_address",
            "label": "Адрес объекта",
            "fieldtype": "Data",
            "insert_after": "olimp_section",
        },
        {
            "fieldname": "object_area_sqm",
            "label": "Площадь, м²",
            "fieldtype": "Float",
            "insert_after": "object_address",
        },
        {
            "fieldname": "object_type",
            "label": "Тип работ",
            "fieldtype": "Select",
            "options": "АКЗ\nКровля\nПромальп\nМонолит\nУсиление",
            "insert_after": "object_area_sqm",
        },
        {
            "fieldname": "customer_contract_no",
            "label": "№ договора с заказчиком",
            "fieldtype": "Data",
            "insert_after": "object_type",
        },
        {
            "fieldname": "tender_link",
            "label": "Тендер",
            "fieldtype": "Link",
            "options": "Tender",
            "insert_after": "customer_contract_no",
        },
        {
            "fieldname": "site_foreman",
            "label": "Прораб",
            "fieldtype": "Link",
            "options": "Employee",
            "insert_after": "tender_link",
        },
        {
            "fieldname": "telegram_chat_id",
            "label": "Telegram Chat ID прораба",
            "fieldtype": "Data",
            "insert_after": "site_foreman",
        },
        {
            "fieldname": "ks2_completion_pct",
            "label": "% закрытия по КС-2",
            "fieldtype": "Percent",
            "read_only": 1,
            "insert_after": "telegram_chat_id",
        },
        {
            "fieldname": "real_margin_pct",
            "label": "Фактическая маржа, %",
            "fieldtype": "Percent",
            "read_only": 1,
            "insert_after": "ks2_completion_pct",
        },
    ],
    "Customer": [
        {
            "fieldname": "olimp_customer_section",
            "label": "Аналитика Олимп",
            "fieldtype": "Section Break",
            "insert_after": "customer_group",
        },
        {
            "fieldname": "customer_segment",
            "label": "Сегмент",
            "fieldtype": "Select",
            "options": "Промышленный\nКоммерческий\nГосзаказчик",
            "insert_after": "olimp_customer_section",
        },
        {
            "fieldname": "credit_period_days",
            "label": "Период оплаты, дней",
            "fieldtype": "Int",
            "insert_after": "customer_segment",
        },
        {
            "fieldname": "preferred_law",
            "label": "Закупочная процедура",
            "fieldtype": "Select",
            "options": "44-ФЗ\n223-ФЗ\nКоммерческий",
            "insert_after": "credit_period_days",
        },
    ],
    "Supplier": [
        {
            "fieldname": "olimp_supplier_section",
            "label": "Олимп",
            "fieldtype": "Section Break",
            "insert_after": "supplier_group",
        },
        {
            "fieldname": "supplier_role",
            "label": "Роль",
            "fieldtype": "Select",
            "options": "Поставщик\nСубподрядчик\nОба",
            "insert_after": "olimp_supplier_section",
        },
        {
            "fieldname": "supplier_specialization",
            "label": "Специализация",
            "fieldtype": "Select",
            "options": "АКЗ\nКровля\nПромальп\nМонолит\nОбщестроительные",
            "insert_after": "supplier_role",
        },
        {
            "fieldname": "performance_rating",
            "label": "Рейтинг (1-5)",
            "fieldtype": "Rating",
            "insert_after": "supplier_specialization",
        },
    ],
}

# Фикстуры
fixtures = ["Custom Field", "Property Setter", "Workflow"]

# Cron задачи
scheduler_events = {
    "daily": [
        "olimp_construction.tasks.check_equipment_alerts",
        "olimp_construction.tasks.check_tender_deadlines",
        "olimp_construction.tasks.check_safety_clearance_expiry",
    ],
    "weekly": [
        "olimp_construction.tasks.update_customer_payment_patterns",
        "olimp_construction.tasks.generate_cashflow_snapshot",
    ],
    "cron": {
        "0 * * * *": [  # раз в час
            "olimp_construction.tasks.run_ai_recommendation_engine",
        ],
    },
}

# Webhook и события
doc_events: dict[str, dict] = {
    "Project": {
        "on_update": "olimp_construction.tasks.recalculate_project_margin",
    },
}
