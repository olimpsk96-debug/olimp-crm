from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import now_datetime, flt


@frappe.whitelist()
def get_director_dashboard() -> dict:
    """Главный дашборд директора — агрегат всех KPI.

    Кэшируется в Redis на 60 секунд.
    """
    frappe.has_permission("Project", throw=True)

    cache_key = "olimp:dashboard:director"
    cached = frappe.cache.get_value(cache_key)
    if cached:
        return cached

    result = {
        "kpi": _get_kpi(),
        "active_projects": _get_active_projects(),
        "hot_tenders": _get_hot_tenders(),
        "ot_alerts": [],       # Фаза 6
        "ai_recommendations": [],  # Фаза 7
        "activity_feed": [],
        "updated_at": now_datetime().isoformat(),
    }

    frappe.cache.set_value(cache_key, result, expires_in_sec=60)
    return result


def _get_kpi() -> dict:
    return {
        "revenue_ytd": 0.0,
        "margin_pct": 0.0,
        "cashflow_balance": 0.0,
        "tenders_active": frappe.db.count("Tender", {"status": ["in", ["Изучаем", "Готовим"]]}),
        "projects_active": frappe.db.count("Project", {"status": "Open"}),
    }


def _get_active_projects() -> list[dict]:
    projects = frappe.get_all(
        "Project",
        filters={"status": "Open"},
        fields=[
            "name",
            "project_name",
            "customer",
            "object_type",
            "object_address",
            "expected_end_date",
            "ks2_completion_pct",
            "real_margin_pct",
            "percent_complete",
        ],
        order_by="expected_end_date asc",
        limit=10,
    )
    return projects


def _get_hot_tenders() -> list[dict]:
    tenders = frappe.get_all(
        "Tender",
        filters={"status": ["in", ["Изучаем", "Готовим"]]},
        fields=[
            "name",
            "tender_name",
            "customer",
            "contract_amount",
            "submission_deadline",
            "status",
            "ai_score",
        ],
        order_by="submission_deadline asc",
        limit=5,
    )
    return tenders
