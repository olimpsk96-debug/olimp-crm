from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate

from olimp_construction.telegram_utils import STATUSES_ACTIVE


@frappe.whitelist()
def get_clients(search: str = "", limit: int = 50) -> list:
    filters = {}
    if search:
        filters["customer_name"] = ["like", f"%{search}%"]

    customers = frappe.get_all(
        "Customer",
        filters=filters,
        fields=["name", "customer_name", "customer_group", "territory", "website", "mobile_no"],
        limit=int(limit),
        order_by="customer_name asc",
    )

    for c in customers:
        c["tenders_count"] = frappe.db.count("Tender", {"customer": c["name"]})
        c["tenders_active"] = frappe.db.count(
            "Tender",
            {"customer": c["name"], "status": ["in", list(STATUSES_ACTIVE)]},
        )
        ks2_sum = frappe.db.sql(
            "SELECT COALESCE(SUM(amount),0) FROM `tabKS2 Act` WHERE customer=%s AND status='Подписан'",
            c["name"],
        )
        c["ks2_total"] = flt(ks2_sum[0][0] if ks2_sum else 0)
        last_int = frappe.db.get_value(
            "Interaction",
            {"customer": c["name"]},
            "date",
            order_by="date desc",
        )
        c["last_interaction"] = str(last_int) if last_int else None
        deals_active = frappe.db.count(
            "Deal",
            {"customer": c["name"], "status": ["not in", ["Закрыт выигран", "Закрыт проигран"]]},
        )
        c["deals_active"] = deals_active

    return customers


@frappe.whitelist()
def get_client(name: str) -> dict:
    customer = frappe.get_doc("Customer", name)

    tenders = frappe.get_all(
        "Tender",
        filters={"customer": name},
        fields=["name", "title", "status", "nmck", "deadline_date", "result"],
        order_by="deadline_date desc",
        limit=10,
    )

    ks2_acts = frappe.get_all(
        "KS2 Act",
        filters={"customer": name},
        fields=["name", "title", "amount", "status", "payment_status", "payment_due_date"],
        order_by="modified desc",
        limit=10,
    )

    interactions = frappe.get_all(
        "Interaction",
        filters={"customer": name},
        fields=["name", "interaction_type", "date", "contact_name", "summary", "result", "next_action", "next_action_date", "tender", "deal"],
        order_by="date desc",
        limit=20,
    )

    deals = frappe.get_all(
        "Deal",
        filters={"customer": name},
        fields=["name", "title", "status", "amount_estimated", "probability_pct", "expected_close_date"],
        order_by="modified desc",
    )

    contacts = frappe.get_all(
        "Contact",
        filters=[["Dynamic Link", "link_doctype", "=", "Customer"], ["Dynamic Link", "link_name", "=", name]],
        fields=["name", "full_name", "designation", "mobile_no", "email_id"],
        limit=10,
    )

    return {
        "name": customer.name,
        "customer_name": customer.customer_name,
        "customer_group": customer.customer_group,
        "territory": customer.territory,
        "website": customer.website,
        "mobile_no": customer.mobile_no,
        "tenders": tenders,
        "ks2_acts": ks2_acts,
        "interactions": interactions,
        "deals": deals,
        "contacts": contacts,
    }


@frappe.whitelist()
def save_interaction(data: dict) -> dict:
    if isinstance(data, str):
        import json
        data = json.loads(data)

    name = data.get("name")
    if name:
        doc = frappe.get_doc("Interaction", name)
        doc.update(data)
    else:
        doc = frappe.new_doc("Interaction")
        doc.update(data)

    doc.save(ignore_permissions=True)
    return {"name": doc.name}


@frappe.whitelist()
def delete_interaction(name: str) -> dict:
    frappe.delete_doc("Interaction", name, ignore_permissions=True)
    return {"ok": True}


@frappe.whitelist()
def get_deals(status: str = "") -> list:
    filters = {}
    if status:
        filters["status"] = status

    deals = frappe.get_all(
        "Deal",
        filters=filters,
        fields=["name", "title", "customer", "status", "amount_estimated", "probability_pct", "expected_close_date", "source", "contact_name", "tender"],
        order_by="modified desc",
    )

    for d in deals:
        d["interactions_count"] = frappe.db.count("Interaction", {"deal": d["name"]})

    return deals


@frappe.whitelist()
def save_deal(data: dict) -> dict:
    if isinstance(data, str):
        import json
        data = json.loads(data)

    name = data.get("name")
    if name:
        doc = frappe.get_doc("Deal", name)
        doc.update(data)
    else:
        doc = frappe.new_doc("Deal")
        doc.update(data)

    doc.save(ignore_permissions=True)
    return {"name": doc.name}


@frappe.whitelist()
def set_deal_status(name: str, status: str) -> dict:
    frappe.db.set_value("Deal", name, "status", status)
    return {"ok": True}


@frappe.whitelist()
def save_client(data: dict) -> dict:
    if isinstance(data, str):
        import json
        data = json.loads(data)

    name = data.get("name")
    customer_name = data.get("customer_name")

    if not customer_name:
        frappe.throw(_("Название клиента обязательно"))

    default_territory = frappe.db.get_value("Territory", {"name": "All Territories"}, "name") or "All Territories"
    default_group = frappe.db.get_value("Customer Group", {"name": "Commercial"}, "name") or "All Customer Groups"

    if name and frappe.db.exists("Customer", name):
        doc = frappe.get_doc("Customer", name)
        doc.customer_name = customer_name
        if data.get("customer_group"):
            doc.customer_group = data["customer_group"]
        if data.get("territory"):
            doc.territory = data["territory"]
        doc.website = data.get("website") or ""
        doc.mobile_no = data.get("mobile_no") or ""
        doc.save(ignore_permissions=True)
        return {"name": doc.name}

    doc = frappe.new_doc("Customer")
    doc.customer_name = customer_name
    doc.customer_group = data.get("customer_group") or default_group
    doc.territory = data.get("territory") or default_territory
    doc.website = data.get("website") or ""
    doc.mobile_no = data.get("mobile_no") or ""
    doc.insert(ignore_permissions=True)
    return {"name": doc.name}


@frappe.whitelist()
def save_contact(data: dict) -> dict:
    if isinstance(data, str):
        import json
        data = json.loads(data)

    customer = data.get("customer")
    if not customer:
        frappe.throw(_("Клиент обязателен"))

    name = data.get("name")
    if name and frappe.db.exists("Contact", name):
        doc = frappe.get_doc("Contact", name)
    else:
        doc = frappe.new_doc("Contact")
        doc.append("links", {"link_doctype": "Customer", "link_name": customer})

    first_name = data.get("first_name") or data.get("full_name", "").split(" ")[0] or "—"
    doc.first_name = first_name
    doc.last_name = data.get("last_name") or ""
    doc.designation = data.get("designation") or ""

    mobile = data.get("mobile_no")
    email = data.get("email_id")

    doc.phone_nos = []
    if mobile:
        doc.append("phone_nos", {"phone": mobile, "is_primary_mobile_no": 1})

    doc.email_ids = []
    if email:
        doc.append("email_ids", {"email_id": email, "is_primary": 1})

    if name:
        doc.save(ignore_permissions=True)
    else:
        doc.insert(ignore_permissions=True)

    return {"name": doc.name}


@frappe.whitelist()
def delete_contact(name: str) -> dict:
    frappe.delete_doc("Contact", name, ignore_permissions=True)
    return {"ok": True}


@frappe.whitelist()
def bulk_import_customers(rows: list | str, dry_run: int | bool = 0) -> dict:
    """Массовый импорт клиентов из CSV/JSON.

    rows: массив словарей с ключами:
      customer_name, customer_type, territory?, customer_group?,
      mobile_no?, email_id?, tax_id?, website?, customer_details?, industry?

    Дубль (existing customer_name) → updated если есть что заполнить, иначе skipped.
    """
    import json as _json

    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager", frappe.PermissionError)

    if isinstance(rows, str):
        rows = _json.loads(rows)
    if not isinstance(rows, list):
        frappe.throw("rows должен быть массивом")

    is_dry = bool(int(dry_run or 0))

    default_territory = (
        frappe.db.get_value("Territory", {"is_group": 0}, "name") or "All Territories"
    )
    default_group = (
        frappe.db.get_value("Customer Group", {"is_group": 0}, "name") or "Commercial"
    )

    created = 0
    updated = 0
    skipped = 0
    errors: list[dict] = []

    for idx, row in enumerate(rows):
        try:
            name = (row.get("customer_name") or "").strip()[:140]
            if not name:
                errors.append({"row": idx + 1, "error": "Пустое customer_name"})
                skipped += 1
                continue

            existing = frappe.db.exists("Customer", {"customer_name": name})
            if existing:
                if is_dry:
                    updated += 1
                    continue
                doc = frappe.get_doc("Customer", existing)
                changed = False
                for fld in ("mobile_no", "email_id", "tax_id", "website", "industry"):
                    val = (row.get(fld) or "").strip()
                    if val and not doc.get(fld):
                        setattr(doc, fld, val[:140])
                        changed = True
                if changed:
                    doc.save(ignore_permissions=True)
                    updated += 1
                else:
                    skipped += 1
                continue

            if is_dry:
                created += 1
                continue

            ct = (row.get("customer_type") or "").strip()
            if ct not in ("Company", "Individual"):
                ct = "Company" if any(kw in name.lower() for kw in ("ооо", "оао", "ао", "ип", "зао", "пао")) else "Individual"

            doc = frappe.get_doc({
                "doctype": "Customer",
                "customer_name": name,
                "customer_type": ct,
                "territory": (row.get("territory") or "").strip() or default_territory,
                "customer_group": (row.get("customer_group") or "").strip() or default_group,
                "mobile_no": (row.get("mobile_no") or "").strip()[:50] or None,
                "email_id": (row.get("email_id") or "").strip()[:140] or None,
                "tax_id": (row.get("tax_id") or "").strip()[:50] or None,
                "website": (row.get("website") or "").strip()[:140] or None,
                "industry": (row.get("industry") or "").strip()[:100] or None,
                "customer_details": (row.get("customer_details") or "").strip()[:2000] or None,
            })
            doc.insert(ignore_permissions=True)
            created += 1

        except Exception as e:
            errors.append({"row": idx + 1, "name": row.get("customer_name", "?"), "error": str(e)[:200]})
            skipped += 1

    if not is_dry:
        frappe.db.commit()

    return {
        "ok": True,
        "dry_run": is_dry,
        "total": len(rows),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors[:50],
    }


@frappe.whitelist()
def get_crm_stats() -> dict:
    today = getdate(nowdate())

    total_clients = frappe.db.count("Customer")

    deals_by_status = frappe.db.sql(
        """SELECT status, COUNT(*) as cnt, COALESCE(SUM(amount_estimated),0) as total
           FROM `tabDeal` GROUP BY status""",
        as_dict=True,
    )
    pipeline_amount = sum(
        flt(r["total"]) for r in deals_by_status
        if r["status"] not in ("Закрыт выигран", "Закрыт проигран")
    )
    active_deals = sum(
        r["cnt"] for r in deals_by_status
        if r["status"] not in ("Закрыт выигран", "Закрыт проигран")
    )

    interactions_week = frappe.db.sql(
        "SELECT COUNT(*) FROM `tabInteraction` WHERE date >= DATE_SUB(%s, INTERVAL 7 DAY)",
        str(today),
    )[0][0] or 0

    next_actions = frappe.get_all(
        "Interaction",
        filters={"next_action_date": ["<=", str(today)], "next_action": ["!=", ""]},
        fields=["name", "customer", "next_action", "next_action_date"],
        order_by="next_action_date asc",
        limit=5,
    )

    return {
        "total_clients": total_clients,
        "active_deals": active_deals,
        "pipeline_amount": flt(pipeline_amount),
        "interactions_week": int(interactions_week),
        "next_actions": next_actions,
        "deals_by_status": deals_by_status,
    }
