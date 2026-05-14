"""Одноразовая настройка ролей и прав для сотрудников строительной компании."""
from __future__ import annotations

import os

import frappe


# Роли с описанием
ROLES = [
    {"name": "Прораб",                "desc": "Прораб на объекте — отчёты, заявки на материалы, фиксация инцидентов"},
    {"name": "Инженер ОТ-ТБ",         "desc": "Инженер по охране труда — инциденты, журналы инструктажа, наряды"},
    {"name": "Главный инженер",       "desc": "Технический руководитель — техника, ТО, парк машин, проекты"},
    {"name": "Сметчик",               "desc": "Подготовка смет, импорт из Гранд-Сметы, расчёт маржи"},
    {"name": "Тендерный менеджер",    "desc": "Поиск и подача тендеров, AI-оценка, ведение pipeline"},
    {"name": "Снабженец",             "desc": "Заявки на материалы, работа с поставщиками, закупки"},
    {"name": "Бухгалтер Олимп",       "desc": "КС-2/КС-3, контроль оплат, ДДС, дебиторка/кредиторка"},
    {"name": "Менеджер продаж Олимп", "desc": "CRM — клиенты, контакты, сделки, история взаимодействий"},
]

# Матрица прав: { роль: { DocType: [список прав] } }
# Права: read, write, create, delete, submit, cancel, amend, print, email, export, share, report
PERMISSIONS: dict[str, dict[str, list[str]]] = {
    "Прораб": {
        "Foreman Report":      ["read", "write", "create"],
        "Safety Incident":     ["read", "write", "create"],
        "Material Request":    ["read", "write", "create"],
        "Supply Item":         ["read", "write", "create"],
        "Construction Project": ["read"],
        "Equipment":           ["read"],
        "Customer":            ["read"],
    },
    "Инженер ОТ-ТБ": {
        "Safety Incident":      ["read", "write", "create", "delete", "print", "report"],
        "Foreman Report":       ["read", "report"],
        "Construction Project": ["read"],
        "Equipment":            ["read"],
    },
    "Главный инженер": {
        "Equipment":            ["read", "write", "create", "delete", "print", "report"],
        "Maintenance Log":      ["read", "write", "create", "delete", "print"],
        "Fuel Log":             ["read", "write", "create", "delete", "print"],
        "Construction Project": ["read", "write", "report"],
        "Foreman Report":       ["read", "report"],
        "Safety Incident":      ["read"],
        "Material Request":     ["read", "report"],
    },
    "Сметчик": {
        "Estimate":             ["read", "write", "create", "delete", "print", "export", "report"],
        "Estimate Item":        ["read", "write", "create", "delete"],
        "Tender":               ["read"],
        "Construction Project": ["read"],
        "Customer":             ["read"],
        "Material Request":     ["read", "report"],
    },
    "Тендерный менеджер": {
        "Tender":               ["read", "write", "create", "delete", "print", "report"],
        "Tender Checklist Item": ["read", "write", "create", "delete"],
        "Estimate":             ["read"],
        "Customer":             ["read", "write", "create"],
        "Construction Project": ["read"],
    },
    "Снабженец": {
        "Material Request":     ["read", "write", "create", "delete", "print", "report"],
        "Supply Item":          ["read", "write", "create", "delete"],
        "Estimate":             ["read"],
        "Construction Project": ["read"],
        "Equipment":            ["read"],
    },
    "Бухгалтер Олимп": {
        "KS2 Act":              ["read", "write", "create", "delete", "submit", "cancel", "print", "report"],
        "KS2 Item":             ["read", "write", "create", "delete"],
        "Customer":             ["read"],
        "Construction Project": ["read", "report"],
        "Estimate":             ["read"],
        "Material Request":     ["read"],
    },
    "Менеджер продаж Олимп": {
        "Customer":             ["read", "write", "create"],
        "Contact":              ["read", "write", "create"],
        "Deal":                 ["read", "write", "create", "delete", "report"],
        "Interaction":          ["read", "write", "create", "delete", "report"],
        "Tender":               ["read"],
        "Construction Project": ["read"],
    },
}


@frappe.whitelist()
def setup_construction_roles() -> dict:
    """Создаёт роли и назначает права. Идемпотентно — можно запускать повторно."""
    created_roles = []
    skipped_roles = []
    permissions_added = []

    # 1) Роли
    for r in ROLES:
        if frappe.db.exists("Role", r["name"]):
            skipped_roles.append(r["name"])
            continue
        doc = frappe.new_doc("Role")
        doc.role_name = r["name"]
        doc.desk_access = 1
        doc.is_custom = 1
        doc.insert(ignore_permissions=True)
        created_roles.append(r["name"])

    # 2) Права
    for role_name, doctype_perms in PERMISSIONS.items():
        for doctype, perms in doctype_perms.items():
            if not frappe.db.exists("DocType", doctype):
                frappe.logger().warning(f"Skip permissions for unknown DocType: {doctype}")
                continue

            # Удаляем существующие Custom DocPerm для пары role × doctype (чтобы переписать)
            frappe.db.sql(
                """DELETE FROM `tabCustom DocPerm`
                   WHERE role=%s AND parent=%s""",
                (role_name, doctype),
            )

            perm = frappe.new_doc("Custom DocPerm")
            perm.parent = doctype
            perm.parenttype = "DocType"
            perm.parentfield = "permissions"
            perm.role = role_name
            perm.permlevel = 0
            for p in perms:
                setattr(perm, p, 1)
            perm.insert(ignore_permissions=True)
            permissions_added.append(f"{role_name} × {doctype} ({', '.join(perms)})")

    frappe.db.commit()
    frappe.clear_cache()

    return {
        "created_roles": created_roles,
        "skipped_roles": skipped_roles,
        "permissions_count": len(permissions_added),
        "permissions": permissions_added,
    }


PRINT_FORMATS = [
    {
        "name": "КС-2 (унифицированная форма)",
        "doc_type": "KS2 Act",
        "file": "kc_2_official/kc_2_official.html",
    },
    {
        "name": "КС-3 (унифицированная форма)",
        "doc_type": "KS3 Act",
        "file": "kc_3_official/kc_3_official.html",
    },
    {
        "name": "КС-6 (общий журнал работ)",
        "doc_type": "Work Log",
        "file": "kc_6_official/kc_6_official.html",
    },
]


def _read_template(rel_path: str) -> str:
    app_path = frappe.get_app_path("olimp_construction")
    full = os.path.join(app_path, "print_format", rel_path)
    with open(full, encoding="utf-8") as fh:
        return fh.read()


@frappe.whitelist()
def setup_print_formats() -> dict:
    """Создаёт/обновляет Print Format КС-2 и КС-3 в гос.форме (ОКУД 0322005/0322001)."""
    created, updated = [], []

    for pf in PRINT_FORMATS:
        html = _read_template(pf["file"])

        if frappe.db.exists("Print Format", pf["name"]):
            doc = frappe.get_doc("Print Format", pf["name"])
            doc.html = html
            doc.print_format_type = "Jinja"
            doc.standard = "No"  # No = custom (HTML в БД), чтобы можно было править из UI
            doc.disabled = 0
            doc.module = "Olimp Construction"
            doc.save(ignore_permissions=True)
            updated.append(pf["name"])
        else:
            doc = frappe.get_doc({
                "doctype": "Print Format",
                "name": pf["name"],
                "doc_type": pf["doc_type"],
                "module": "Olimp Construction",
                "standard": "No",
                "custom_format": 1,
                "print_format_type": "Jinja",
                "disabled": 0,
                "html": html,
                "font_size": 9,
                "margin_top": 12.0,
                "margin_bottom": 12.0,
                "margin_left": 12.0,
                "margin_right": 12.0,
                "default_print_language": "ru",
            })
            doc.insert(ignore_permissions=True)
            created.append(pf["name"])

    frappe.db.commit()
    return {"created": created, "updated": updated}


@frappe.whitelist()
def create_test_user(email: str, first_name: str, last_name: str, role: str) -> dict:
    """Создать тестового пользователя с указанной ролью."""
    if frappe.db.exists("User", email):
        return {"ok": False, "error": "User already exists", "email": email}

    if not frappe.db.exists("Role", role):
        return {"ok": False, "error": f"Role '{role}' does not exist"}

    user = frappe.new_doc("User")
    user.email = email
    user.first_name = first_name
    user.last_name = last_name
    user.enabled = 1
    user.user_type = "System User"
    user.send_welcome_email = 0
    user.append("roles", {"role": role})
    user.insert(ignore_permissions=True)
    return {"ok": True, "email": email, "role": role}
