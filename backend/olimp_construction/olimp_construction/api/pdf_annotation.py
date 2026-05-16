"""API для PDF Annotation — разметка PDF документов.

Эндпоинты:
- get_list(reference_doctype?, reference_name?) — все разметки по документу
- get_detail(name) — разметка + annotations_json как объект
- save_annotation(data) — create/update
- delete_annotation(name)
- sign_annotation(name, signed_by, signed_role) — подписать
"""
from __future__ import annotations

import json

import frappe
from frappe import _
from frappe.utils import now_datetime


@frappe.whitelist()
def get_list(reference_doctype: str | None = None, reference_name: str | None = None) -> list[dict]:
    frappe.has_permission("PDF Annotation", throw=True)
    filters: dict = {}
    if reference_doctype:
        filters["reference_doctype"] = reference_doctype
    if reference_name:
        filters["reference_name"] = reference_name
    return frappe.get_all(
        "PDF Annotation",
        filters=filters,
        fields=[
            "name", "title", "reference_doctype", "reference_name",
            "pdf_file", "status", "annotation_count",
            "signed_by", "signed_at", "signed_role",
            "modified", "owner",
        ],
        order_by="modified DESC",
        limit_page_length=200,
    )


@frappe.whitelist()
def get_detail(name: str) -> dict:
    frappe.has_permission("PDF Annotation", "read", doc=name, throw=True)
    doc = frappe.get_doc("PDF Annotation", name)
    out = doc.as_dict()
    try:
        out["annotations"] = json.loads(doc.annotations_json or "[]")
    except json.JSONDecodeError:
        out["annotations"] = []
    return out


@frappe.whitelist()
def save_annotation(data: dict | str) -> dict:
    if isinstance(data, str):
        data = json.loads(data)

    name = data.get("name")
    annotations = data.pop("annotations", None)
    if annotations is not None:
        data["annotations_json"] = json.dumps(annotations, ensure_ascii=False)

    if name and frappe.db.exists("PDF Annotation", name):
        frappe.has_permission("PDF Annotation", "write", doc=name, throw=True)
        doc = frappe.get_doc("PDF Annotation", name)
        for k, v in data.items():
            if k in ("doctype",):
                continue
            setattr(doc, k, v)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"name": doc.name, "updated": True, "annotation_count": doc.annotation_count}

    frappe.has_permission("PDF Annotation", "create", throw=True)
    if not data.get("title"):
        frappe.throw(_("Укажи название"))
    if not data.get("reference_doctype") or not data.get("reference_name"):
        frappe.throw(_("Укажи связанный документ"))

    doc = frappe.get_doc({"doctype": "PDF Annotation", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "created": True}


@frappe.whitelist()
def delete_annotation(name: str) -> dict:
    frappe.has_permission("PDF Annotation", "delete", doc=name, throw=True)
    frappe.delete_doc("PDF Annotation", name, ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "deleted": name}


@frappe.whitelist()
def sign_annotation(name: str, signed_by: str, signed_role: str | None = None) -> dict:
    frappe.has_permission("PDF Annotation", "write", doc=name, throw=True)
    if not signed_by:
        frappe.throw(_("Укажи ФИО подписанта"))
    doc = frappe.get_doc("PDF Annotation", name)
    doc.signed_by = signed_by
    doc.signed_role = signed_role or doc.signed_role
    doc.signed_at = now_datetime()
    doc.status = "Подписан"
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "name": name, "signed_at": str(doc.signed_at)}
