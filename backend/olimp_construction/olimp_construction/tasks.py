from __future__ import annotations

import frappe
from frappe.utils import getdate, add_days


def check_equipment_alerts() -> None:
    """Daily: проверяет сроки ТО, страховок, СРО по технике."""
    pass  # Фаза 8


def check_tender_deadlines() -> None:
    """Daily: напоминания о дедлайнах тендеров."""
    today = getdate()
    warning_days = [7, 3, 1]

    for days in warning_days:
        target_date = add_days(today, days)
        tenders = frappe.get_all(
            "Tender",
            filters={"submission_deadline": target_date, "status": "Готовим"},
            fields=["name", "tender_name", "submission_deadline"],
        )
        for tender in tenders:
            frappe.logger().info(
                f"Tender deadline alert: {tender['name']} — {days} дней до дедлайна"
            )


def check_safety_clearance_expiry() -> None:
    """Daily: проверяет истекающие допуски ОТ/ТБ."""
    pass  # Фаза 6


def update_customer_payment_patterns() -> None:
    """Weekly: пересчитывает паттерны оплаты заказчиков."""
    pass  # Фаза 5


def generate_cashflow_snapshot() -> None:
    """Weekly: создаёт снимок прогноза cashflow."""
    pass  # Фаза 5


def run_ai_recommendation_engine() -> None:
    """Hourly: запускает движок рекомендаций AI."""
    pass  # Фаза 7


def recalculate_project_margin(doc: frappe.Document, method: str) -> None:
    """Trigger on Project update: пересчитывает фактическую маржу."""
    pass  # Фаза 2
