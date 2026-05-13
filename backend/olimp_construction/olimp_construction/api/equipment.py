import frappe
from frappe.utils import flt, getdate, nowdate, add_days
import json


# ── Equipment ────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_list(status=None, category=None):
    filters = {}
    if status:
        filters["status"] = status
    if category:
        filters["category"] = category
    items = frappe.get_all(
        "Equipment",
        filters=filters,
        fields=[
            "name", "equipment_name", "category", "status",
            "current_location", "responsible_person", "project",
            "next_maintenance_date", "insurance_expiry",
            "certification_expiry", "sro_expiry",
            "purchase_price", "engine_hours", "odometer",
        ],
        order_by="next_maintenance_date asc",
    )
    today = getdate(nowdate())
    for eq in items:
        eq["maintenance_days_left"] = None
        if eq.get("next_maintenance_date"):
            eq["maintenance_days_left"] = (getdate(eq["next_maintenance_date"]) - today).days
    return items


@frappe.whitelist()
def get_detail(name):
    eq = frappe.get_doc("Equipment", name)
    d = eq.as_dict()

    maintenance = frappe.get_all(
        "Maintenance Log",
        filters={"equipment": name},
        fields=["name", "maintenance_type", "maintenance_date", "performed_by",
                "total_cost", "description", "next_maintenance_date"],
        order_by="maintenance_date desc",
        limit_page_length=10,
    )

    fuel_30 = frappe.db.sql(
        """SELECT COALESCE(SUM(liters),0) as liters, COALESCE(SUM(total_amount),0) as amount
           FROM `tabFuel Log`
           WHERE equipment=%s AND fuel_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)""",
        name, as_dict=True
    )
    fuel_logs = frappe.get_all(
        "Fuel Log",
        filters={"equipment": name},
        fields=["name", "fuel_date", "liters", "total_amount", "filled_by", "odometer_reading"],
        order_by="fuel_date desc",
        limit_page_length=5,
    )
    total_maintenance_cost = frappe.db.sql(
        "SELECT COALESCE(SUM(total_cost),0) FROM `tabMaintenance Log` WHERE equipment=%s",
        name
    )[0][0] or 0

    d["maintenance_logs"] = maintenance
    d["fuel_30d"] = fuel_30[0] if fuel_30 else {"liters": 0, "amount": 0}
    d["fuel_logs"] = fuel_logs
    d["total_maintenance_cost"] = flt(total_maintenance_cost)
    return d


@frappe.whitelist()
def save_equipment(data):
    if isinstance(data, str):
        data = json.loads(data)
    if data.get("name") and frappe.db.exists("Equipment", data["name"]):
        doc = frappe.get_doc("Equipment", data["name"])
        doc.update(data)
    else:
        doc = frappe.get_doc({"doctype": "Equipment", **data})
        doc.insert(ignore_permissions=True)
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "status": doc.status}


@frappe.whitelist()
def set_status(name, status):
    frappe.db.set_value("Equipment", name, "status", status)
    frappe.db.commit()
    return {"ok": True, "name": name, "status": status}


# ── Maintenance Log ──────────────────────────────────────────────────────────

@frappe.whitelist()
def log_maintenance(data):
    if isinstance(data, str):
        data = json.loads(data)
    doc = frappe.get_doc({"doctype": "Maintenance Log", **data})
    doc.insert(ignore_permissions=True)
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "total_cost": doc.total_cost}


# ── Fuel Log ─────────────────────────────────────────────────────────────────

@frappe.whitelist()
def log_fuel(data):
    if isinstance(data, str):
        data = json.loads(data)
    doc = frappe.get_doc({"doctype": "Fuel Log", **data})
    doc.insert(ignore_permissions=True)
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "total_amount": doc.total_amount}


# ── Stats ────────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_stats():
    today = getdate(nowdate())
    warn_date = add_days(today, 7)

    total = frappe.db.count("Equipment", {"status": ["!=", "Списана"]})
    available = frappe.db.count("Equipment", {"status": "Доступна"})
    in_use = frappe.db.count("Equipment", {"status": "На объекте"})
    on_maintenance = frappe.db.count("Equipment", {"status": ["in", ["На ТО", "В ремонте"]]})
    maintenance_due = frappe.db.count(
        "Equipment",
        {"status": ["!=", "Списана"], "next_maintenance_date": ["<=", str(warn_date)]}
    )
    fuel_month = frappe.db.sql(
        """SELECT COALESCE(SUM(total_amount),0)
           FROM `tabFuel Log`
           WHERE fuel_date >= DATE_FORMAT(CURDATE(),'%%Y-%%m-01')""",
    )[0][0] or 0

    return {
        "total": total,
        "available": available,
        "in_use": in_use,
        "on_maintenance": on_maintenance,
        "maintenance_due_7d": maintenance_due,
        "fuel_month": flt(fuel_month, 0),
    }
