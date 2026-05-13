import frappe
from frappe.utils import flt, getdate, nowdate, add_days
from datetime import date


@frappe.whitelist()
def get_dashboard():
    current_balance = flt(frappe.db.get_default("olimp_cash_balance") or 0)
    today = getdate(nowdate())

    ks2_acts = frappe.get_all(
        "KS2 Act",
        filters={"status": "Подписан", "payment_status": ["!=", "Оплачено"]},
        fields=["name", "title", "amount", "payment_received", "payment_due_date", "customer"],
    )
    incoming = []
    for act in ks2_acts:
        expected = flt(act.amount) - flt(act.payment_received)
        if expected <= 0:
            continue
        due = act.payment_due_date
        days_left = (getdate(due) - today).days if due else None
        incoming.append({
            "name": act.name,
            "title": act.title,
            "customer": act.customer,
            "amount": expected,
            "due_date": str(due) if due else None,
            "days_left": days_left,
            "overdue": days_left is not None and days_left < 0,
            "type": "income",
        })
    incoming.sort(key=lambda x: x["due_date"] or "9999-12-31")

    supply_reqs = frappe.get_all(
        "Material Request",
        filters={"status": ["in", ["Одобрена", "Закупается"]]},
        fields=["name", "title", "total_estimated", "needed_by_date", "project"],
    )
    outgoing = []
    for req in supply_reqs:
        amt = flt(req.total_estimated)
        if amt <= 0:
            continue
        due = req.needed_by_date
        days_left = (getdate(due) - today).days if due else None
        outgoing.append({
            "name": req.name,
            "title": req.title,
            "project": req.project,
            "amount": amt,
            "due_date": str(due) if due else None,
            "days_left": days_left,
            "overdue": days_left is not None and days_left < 0,
            "type": "expense",
        })
    outgoing.sort(key=lambda x: x["due_date"] or "9999-12-31")

    total_incoming = sum(i["amount"] for i in incoming)
    total_outgoing = sum(o["amount"] for o in outgoing)
    projected = current_balance + total_incoming - total_outgoing

    # Monthly forecast for next 3 months
    months = _build_monthly_forecast(today, incoming, outgoing)

    return {
        "current_balance": current_balance,
        "total_incoming": total_incoming,
        "total_outgoing": total_outgoing,
        "projected_balance": projected,
        "incoming": incoming,
        "outgoing": outgoing,
        "monthly_forecast": months,
    }


def _build_monthly_forecast(today: date, incoming: list, outgoing: list) -> list:
    result = []
    for offset in range(3):
        month_start = date(today.year, today.month, 1)
        if offset > 0:
            y = today.year + (today.month + offset - 1) // 12
            m = (today.month + offset - 1) % 12 + 1
            month_start = date(y, m, 1)
        if month_start.month == 12:
            month_end = date(month_start.year + 1, 1, 1)
        else:
            month_end = date(month_start.year, month_start.month + 1, 1)

        label = month_start.strftime("%b %Y")
        inc = sum(
            i["amount"] for i in incoming
            if i["due_date"] and month_start <= getdate(i["due_date"]) < month_end
        )
        exp = sum(
            o["amount"] for o in outgoing
            if o["due_date"] and month_start <= getdate(o["due_date"]) < month_end
        )
        result.append({"month": label, "income": inc, "expense": exp, "net": inc - exp})
    return result


@frappe.whitelist()
def set_balance(amount):
    frappe.db.set_default("olimp_cash_balance", flt(amount))
    frappe.db.commit()
    return {"ok": True, "balance": flt(amount)}
