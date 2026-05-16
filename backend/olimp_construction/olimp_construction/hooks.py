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
    "File": [
        {
            "fieldname": "olimp_category",
            "label": "Категория (Олимп)",
            "fieldtype": "Data",
            "insert_after": "attached_to_field",
            "description": "Договор / Сертификат / Фото объекта и т.п. — для документов проектов",
        },
        {
            "fieldname": "olimp_comment",
            "label": "Комментарий (Олимп)",
            "fieldtype": "Small Text",
            "insert_after": "olimp_category",
        },
    ],
    "Estimate": [
        {
            "fieldname": "estimation_method",
            "label": "Метод оценки",
            "fieldtype": "Select",
            "options": "\nРесурсный\nБазисно-индексный\nРесурсно-индексный",
            "insert_after": "estimate_date",
            "description": "Согласно методике Минстроя РФ. Для строек по 44-ФЗ — обычно базисно-индексный.",
        },
        {
            "fieldname": "regional_index",
            "label": "Индекс пересчёта (СМР)",
            "fieldtype": "Float",
            "precision": "4",
            "insert_after": "estimation_method",
            "description": "Индекс Минстроя для перевода базовых цен 2001г в текущие (например, Свердловская обл.).",
        },
    ],
    "Construction Project": [
        {
            "fieldname": "margin_section",
            "label": "Фактическая маржа (авто)",
            "fieldtype": "Section Break",
            "insert_after": "notes",
            "collapsible": 1,
        },
        {
            "fieldname": "real_revenue",
            "label": "Выручка (подписанные КС-2)",
            "fieldtype": "Currency",
            "insert_after": "margin_section",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "real_cost",
            "label": "Расходы (Material Request)",
            "fieldtype": "Currency",
            "insert_after": "real_revenue",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "margin_col_break",
            "fieldtype": "Column Break",
            "insert_after": "real_cost",
        },
        {
            "fieldname": "real_margin_amount",
            "label": "Маржа, ₽",
            "fieldtype": "Currency",
            "insert_after": "margin_col_break",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "real_margin_pct",
            "label": "Маржа, %",
            "fieldtype": "Percent",
            "insert_after": "real_margin_amount",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "ks2_completion_pct",
            "label": "% закрытия по КС-2",
            "fieldtype": "Percent",
            "insert_after": "real_margin_pct",
            "read_only": 1,
            "no_copy": 1,
        },
    ],
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

# После миграции — синхронизировать Custom Fields из словаря custom_fields выше
after_migrate = ["olimp_construction.install.sync_custom_fields"]

# Cron задачи
scheduler_events = {
    "daily": [
        "olimp_construction.tasks.check_equipment_alerts",
        "olimp_construction.tasks.check_tender_deadlines",
        "olimp_construction.tasks.check_safety_clearance_expiry",
        "olimp_construction.tasks.check_crm_followups",
        "olimp_construction.api.certification.check_certification_expiry",
        "olimp_construction.api.evm.save_daily_evm_snapshots",
        "olimp_construction.tasks.check_punch_list_overdue",
        "olimp_construction.api.pipeline.refresh_rotting",
        "olimp_construction.api.pipeline.refresh_ball_overdue",
        "olimp_construction.api.lead_routing.check_missed_leads",
        "olimp_construction.api.guarantees.check_guarantee_expiry",
    ],
    "weekly": [
        "olimp_construction.tasks.update_customer_payment_patterns",
        "olimp_construction.tasks.generate_cashflow_snapshot",
        "olimp_construction.api.ai.template_suggester.suggest_templates",
        "olimp_construction.tasks.rollover_unfinished_work",
    ],
    "cron": {
        "0 * * * *": [  # раз в час
            "olimp_construction.tasks.run_ai_recommendation_engine",
        ],
        "0 9 * * *": [  # 09:00 МСК — утренняя сводка директору
            "olimp_construction.tasks.send_daily_director_digest",
        ],
    },
}

# Webhook и события
doc_events: dict[str, dict] = {
    "Construction Project": {
        "on_update": "olimp_construction.tasks.recalculate_project_margin",
    },
    "KS2 Act": {
        # При смене статуса КС-2 → пересчитать маржу связанного проекта
        "on_update": "olimp_construction.tasks.on_ks2_update_recalc_project",
    },
    "Material Request": {
        "on_update": [
            "olimp_construction.tasks.on_material_request_update_recalc_project",
            "olimp_construction.api.stock.on_material_request_received",
        ],
    },
}
