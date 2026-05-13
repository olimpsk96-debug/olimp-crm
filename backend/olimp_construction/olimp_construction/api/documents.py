"""API документов проекта — использует штатный Frappe File с привязкой к Construction Project.

В нашей терминологии «документ проекта» это:
- договор PDF
- сертификат материала
- фото объекта
- акт скрытых работ
- паспорт оборудования
- и т.п.

Файлы хранятся в Frappe File через attached_to_doctype='Construction Project'.
Категория сохраняется в file.description (с префиксом [cat:Название]).
"""
from __future__ import annotations

import base64

import frappe
from frappe import _


VALID_CATEGORIES = (
    "Договор",
    "Смета (PDF)",
    "Чертёж",
    "Сертификат материала",
    "Паспорт оборудования",
    "Фотофиксация",
    "Акт скрытых работ",
    "Исполнительная документация",
    "Переписка",
    "Прочее",
)


@frappe.whitelist()
def get_project_files(project: str) -> list[dict]:
    """Все файлы привязанные к проекту."""
    frappe.has_permission("Construction Project", "read", doc=project, throw=True)
    files = frappe.get_all(
        "File",
        filters={
            "attached_to_doctype": "Construction Project",
            "attached_to_name": project,
        },
        fields=[
            "name", "file_name", "file_url", "file_size", "file_type",
            "is_private", "olimp_category", "olimp_comment", "owner", "creation",
        ],
        order_by="creation desc",
    )
    for f in files:
        f["category"] = f.get("olimp_category") or "Прочее"
        f["comment"] = f.get("olimp_comment") or ""
    return files


@frappe.whitelist()
def upload_project_file(
    project: str,
    file_name: str,
    file_content: str,
    category: str = "Прочее",
    comment: str = "",
    is_private: int = 1,
) -> dict:
    """Загружает файл с привязкой к проекту.

    file_content — base64-encoded бинарник.
    Категория и комментарий сохраняются в Custom Fields olimp_category / olimp_comment.
    """
    frappe.has_permission("Construction Project", "write", doc=project, throw=True)

    if category not in VALID_CATEGORIES:
        category = "Прочее"

    if not frappe.db.exists("Construction Project", project):
        frappe.throw(_(f"Проект {project} не найден"))

    try:
        decoded = base64.b64decode(file_content)
    except Exception as e:
        frappe.throw(_(f"Не удалось декодировать base64: {e}"))

    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": file_name,
        "attached_to_doctype": "Construction Project",
        "attached_to_name": project,
        "is_private": int(is_private),
        "content": decoded,
        "olimp_category": category,
        "olimp_comment": comment.strip() if comment else "",
    })
    file_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "ok": True,
        "name": file_doc.name,
        "file_url": file_doc.file_url,
        "file_size": file_doc.file_size,
        "category": category,
    }


@frappe.whitelist()
def update_file_category(file_name: str, category: str, comment: str = "") -> dict:
    """Обновляет категорию/комментарий файла."""
    frappe.has_permission("File", "write", throw=True)
    if category not in VALID_CATEGORIES:
        frappe.throw(_(f"Недопустимая категория: {category}"))
    frappe.db.set_value("File", file_name, "olimp_category", category, update_modified=False)
    if comment:
        frappe.db.set_value("File", file_name, "olimp_comment", comment.strip(), update_modified=False)
    frappe.db.commit()
    return {"ok": True, "name": file_name, "category": category}


@frappe.whitelist()
def delete_project_file(file_name: str) -> dict:
    """Удаляет файл проекта."""
    frappe.has_permission("File", "delete", throw=True)
    frappe.delete_doc("File", file_name, ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist()
def get_categories() -> list[str]:
    """Список допустимых категорий документов."""
    return list(VALID_CATEGORIES)
