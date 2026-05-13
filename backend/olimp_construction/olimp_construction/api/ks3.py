"""API для работы со справками о стоимости работ (КС-3)."""
from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate


@frappe.whitelist()
def get_list(project: str = "", status: str = "") -> list:
    filters: dict = {}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status

    acts = frappe.get_all(
        "KS3 Act",
        filters=filters,
        fields=[
            "name", "title", "status", "act_number",
            "project", "customer", "contract_number",
            "period_from", "period_to", "report_date", "signed_date",
            "total_period", "total_with_vat", "total_to_pay",
            "vat_rate", "retention_pct",
        ],
        order_by="report_date desc",
    )
    return acts


@frappe.whitelist()
def get_detail(name: str) -> dict:
    doc = frappe.get_doc("KS3 Act", name)
    return doc.as_dict()


@frappe.whitelist()
def save_act(data: dict) -> dict:
    if isinstance(data, str):
        import json
        data = json.loads(data)

    name = data.get("name")
    if name and frappe.db.exists("KS3 Act", name):
        doc = frappe.get_doc("KS3 Act", name)
        doc.update(data)
    else:
        doc = frappe.new_doc("KS3 Act")
        doc.update(data)

    doc.save(ignore_permissions=True)
    return {"name": doc.name}


@frappe.whitelist()
def set_status(name: str, status: str) -> dict:
    frappe.db.set_value("KS3 Act", name, "status", status)
    if status == "Подписан":
        frappe.db.set_value("KS3 Act", name, "signed_date", nowdate())
    return {"ok": True}


@frappe.whitelist()
def get_ks2_for_project(project: str, status: str = "Подписан") -> list:
    """Список КС-2 актов по проекту для добавления в КС-3."""
    if not project:
        return []
    return frappe.get_all(
        "KS2 Act",
        filters={"project": project, "status": status},
        fields=["name", "title", "act_number", "act_date", "amount"],
        order_by="act_date asc",
    )


@frappe.whitelist()
def create_from_ks2(
    project: str,
    ks2_names: list,
    period_from: str = "",
    period_to: str = "",
    title: str = "",
) -> dict:
    """Создать черновик КС-3 на основе выбранных КС-2 актов."""
    if isinstance(ks2_names, str):
        import json
        ks2_names = json.loads(ks2_names)

    if not project or not ks2_names:
        frappe.throw(_("Укажите проект и хотя бы один КС-2"))

    project_doc = frappe.get_doc("Construction Project", project)

    today = getdate(nowdate())
    year_start = today.replace(month=1, day=1)

    # Собираем позиции из выбранных КС-2 (сумма за период)
    selected_items: dict = {}  # key = work_name, value = aggregate
    for ks2_name in ks2_names:
        ks2 = frappe.get_doc("KS2 Act", ks2_name)
        for it in ks2.items:
            key = it.work_name or it.name
            if key not in selected_items:
                selected_items[key] = {
                    "work_name": it.work_name,
                    "code": getattr(it, "estimate_ref", "") or "",
                    "cost_period": 0,
                    "ks2_act_ref": ks2_name,
                }
            selected_items[key]["cost_period"] += flt(it.amount or 0)

    # Считаем "с начала года" и "с начала строительства" по всем КС-2 проекта
    year_ks2 = frappe.get_all(
        "KS2 Act",
        filters={
            "project": project, "status": "Подписан",
            "act_date": ["between", [str(year_start), str(today)]],
        },
        fields=["name"],
    )
    all_ks2 = frappe.get_all(
        "KS2 Act",
        filters={"project": project, "status": "Подписан"},
        fields=["name"],
    )

    for key, item in selected_items.items():
        year_sum = 0.0
        for ks2 in year_ks2:
            ks2_doc = frappe.get_doc("KS2 Act", ks2.name)
            for it in ks2_doc.items:
                if (it.work_name or it.name) == key:
                    year_sum += flt(it.amount or 0)
        item["cost_since_year"] = year_sum

        start_sum = 0.0
        for ks2 in all_ks2:
            ks2_doc = frappe.get_doc("KS2 Act", ks2.name)
            for it in ks2_doc.items:
                if (it.work_name or it.name) == key:
                    start_sum += flt(it.amount or 0)
        item["cost_since_start"] = start_sum

    # Создаём документ
    doc = frappe.new_doc("KS3 Act")
    doc.title = title or f"Справка КС-3 — {project_doc.title}"
    doc.status = "Черновик"
    doc.project = project
    doc.customer = project_doc.customer
    doc.contract_number = project_doc.contract_number
    doc.period_from = period_from or str(year_start)
    doc.period_to = period_to or str(today)
    doc.report_date = nowdate()
    doc.vat_rate = 20
    doc.retention_pct = 0

    # Tender link
    if project_doc.tender:
        doc.tender = project_doc.tender

    # Связанные КС-2
    for ks2_name in ks2_names:
        doc.append("ks2_acts", {"ks2_act": ks2_name})

    # Позиции
    pos = 1
    for item in selected_items.values():
        doc.append("items", {
            "position_number": pos,
            "work_name": item["work_name"],
            "code": item["code"],
            "cost_period": item["cost_period"],
            "cost_since_year": item["cost_since_year"],
            "cost_since_start": item["cost_since_start"],
            "ks2_act_ref": item["ks2_act_ref"],
        })
        pos += 1

    doc.insert(ignore_permissions=True)
    return {"name": doc.name, "title": doc.title}


@frappe.whitelist()
def get_stats() -> dict:
    """Сводная статистика по КС-3."""
    total = frappe.db.count("KS3 Act")
    signed = frappe.db.count("KS3 Act", {"status": "Подписан"})
    draft = frappe.db.count("KS3 Act", {"status": "Черновик"})

    total_paid_sum = frappe.db.sql(
        "SELECT COALESCE(SUM(total_to_pay),0) FROM `tabKS3 Act` WHERE status='Подписан'",
    )[0][0]
    total_retention = frappe.db.sql(
        "SELECT COALESCE(SUM(retention_amount),0) FROM `tabKS3 Act` WHERE status='Подписан'",
    )[0][0]

    return {
        "total": int(total),
        "signed": int(signed),
        "draft": int(draft),
        "total_to_pay": flt(total_paid_sum),
        "total_retention": flt(total_retention),
    }
