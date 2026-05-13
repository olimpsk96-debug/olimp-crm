"""API для управления сотрудниками строительной компании."""
from __future__ import annotations

import frappe
from frappe import _


CONSTRUCTION_ROLES = [
    "Прораб",
    "Инженер ОТ-ТБ",
    "Главный инженер",
    "Сметчик",
    "Тендерный менеджер",
    "Снабженец",
    "Бухгалтер Олимп",
    "Менеджер продаж Олимп",
]


@frappe.whitelist()
def get_employees() -> list:
    """Список сотрудников: пользователи со строительными ролями."""
    users = frappe.db.sql(
        """SELECT u.name, u.email, u.full_name, u.first_name, u.last_name,
                  u.enabled, u.last_login, u.mobile_no,
                  GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') as roles
           FROM `tabUser` u
           LEFT JOIN `tabHas Role` r ON r.parent = u.name
           WHERE u.user_type='System User'
             AND u.email NOT IN ('Administrator', 'Guest')
             AND u.email NOT LIKE '%@example.com'
           GROUP BY u.name
           ORDER BY u.creation DESC""",
        as_dict=True,
    )

    # Только сотрудники с нашими ролями (или System Manager = директор)
    result = []
    for u in users:
        if not u["roles"]:
            continue
        user_roles = [r.strip() for r in u["roles"].split(",")]
        has_olimp_role = any(r in CONSTRUCTION_ROLES for r in user_roles) or "System Manager" in user_roles
        if not has_olimp_role:
            continue
        olimp_roles = [r for r in user_roles if r in CONSTRUCTION_ROLES or r == "System Manager"]
        u["olimp_roles"] = olimp_roles
        result.append(u)

    return result


@frappe.whitelist()
def save_employee(data: dict) -> dict:
    if isinstance(data, str):
        import json
        data = json.loads(data)

    email = data.get("email")
    first_name = data.get("first_name", "")
    last_name = data.get("last_name", "")
    mobile_no = data.get("mobile_no", "")
    role = data.get("role")
    enabled = data.get("enabled", 1)

    if not email or not role:
        frappe.throw(_("Email и роль обязательны"))

    if frappe.db.exists("User", email):
        user = frappe.get_doc("User", email)
        user.first_name = first_name or user.first_name
        user.last_name = last_name
        user.mobile_no = mobile_no
        user.enabled = int(enabled)
        # Сбрасываем строительные роли и ставим выбранную
        user.roles = [r for r in user.roles if r.role not in CONSTRUCTION_ROLES]
        user.append("roles", {"role": role})
        user.save(ignore_permissions=True)
        return {"ok": True, "email": email, "updated": True}

    user = frappe.new_doc("User")
    user.email = email
    user.first_name = first_name
    user.last_name = last_name
    user.mobile_no = mobile_no
    user.enabled = int(enabled)
    user.user_type = "System User"
    user.send_welcome_email = 0
    user.append("roles", {"role": role})
    user.insert(ignore_permissions=True)
    return {"ok": True, "email": email, "updated": False}


@frappe.whitelist()
def toggle_employee(email: str, enabled: int) -> dict:
    frappe.db.set_value("User", email, "enabled", int(enabled))
    return {"ok": True}


@frappe.whitelist()
def get_role_stats() -> list:
    """Сколько сотрудников на каждой роли."""
    stats = []
    for role in CONSTRUCTION_ROLES + ["System Manager"]:
        count = frappe.db.sql(
            """SELECT COUNT(DISTINCT u.name) FROM `tabUser` u
               JOIN `tabHas Role` r ON r.parent=u.name
               WHERE r.role=%s AND u.enabled=1 AND u.user_type='System User'
                 AND u.email NOT IN ('Administrator','Guest')""",
            role,
        )[0][0]
        stats.append({"role": role, "count": int(count)})
    return stats
