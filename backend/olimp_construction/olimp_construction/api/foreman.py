import frappe
from frappe.utils import today, add_days, getdate


# ── Foreman Reports ─────────────────────────────────────────────────────────

@frappe.whitelist()
def get_reports(project=None, status=None, limit=50):
    filters = {}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status
    reports = frappe.get_all(
        "Foreman Report",
        filters=filters,
        fields=["name", "title", "status", "project", "foreman_name",
                "report_date", "workers_count", "has_safety_incident"],
        order_by="report_date desc",
        limit_page_length=int(limit),
    )
    return reports


@frappe.whitelist()
def get_report(name):
    doc = frappe.get_doc("Foreman Report", name)
    return doc.as_dict()


@frappe.whitelist()
def save_report(data):
    if isinstance(data, str):
        import json
        data = json.loads(data)

    if data.get("name") and frappe.db.exists("Foreman Report", data["name"]):
        doc = frappe.get_doc("Foreman Report", data["name"])
        doc.update(data)
    else:
        doc = frappe.get_doc({"doctype": "Foreman Report", **data})
        doc.insert(ignore_permissions=True)

    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "status": doc.status}


@frappe.whitelist()
def set_report_status(name, status):
    frappe.db.set_value("Foreman Report", name, "status", status)
    frappe.db.commit()
    return {"ok": True, "name": name, "status": status}


# ── Safety Incidents ─────────────────────────────────────────────────────────

@frappe.whitelist()
def get_incidents(project=None, status=None, limit=50):
    filters = {}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status
    incidents = frappe.get_all(
        "Safety Incident",
        filters=filters,
        fields=["name", "title", "severity", "status", "project",
                "incident_date", "affected_person", "resolved_date"],
        order_by="incident_date desc",
        limit_page_length=int(limit),
    )
    return incidents


@frappe.whitelist()
def get_incident(name):
    doc = frappe.get_doc("Safety Incident", name)
    return doc.as_dict()


@frappe.whitelist()
def save_incident(data):
    if isinstance(data, str):
        import json
        data = json.loads(data)

    if data.get("name") and frappe.db.exists("Safety Incident", data["name"]):
        doc = frappe.get_doc("Safety Incident", data["name"])
        doc.update(data)
    else:
        doc = frappe.get_doc({"doctype": "Safety Incident", **data})
        doc.insert(ignore_permissions=True)

    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "status": doc.status}


@frappe.whitelist()
def set_incident_status(name, status):
    frappe.db.set_value("Safety Incident", name, "status", status)
    frappe.db.commit()
    return {"ok": True, "name": name, "status": status}


# ── Dashboard stats ───────────────────────────────────────────────────────────

@frappe.whitelist()
def get_stats():
    today_str = today()
    month_start = today_str[:8] + "01"

    reports_this_month = frappe.db.count(
        "Foreman Report",
        filters={"report_date": [">=", month_start]},
    )
    workers_today = frappe.db.sql(
        "SELECT COALESCE(SUM(workers_count),0) FROM `tabForeman Report` WHERE report_date=%s",
        today_str
    )[0][0] or 0
    open_incidents = frappe.db.count(
        "Safety Incident",
        filters={"status": ["in", ["Открыт", "В работе"]]},
    )
    critical_incidents = frappe.db.count(
        "Safety Incident",
        filters={"status": ["in", ["Открыт", "В работе"]], "severity": ["in", ["Тяжёлый", "Критический"]]},
    )
    return {
        "reports_this_month": reports_this_month,
        "workers_today": int(workers_today),
        "open_incidents": open_incidents,
        "critical_incidents": critical_incidents,
    }
