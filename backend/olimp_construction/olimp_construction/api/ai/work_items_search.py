"""API для поиска и работы с Catalog Work Item (55K расценок CWICR)."""
from __future__ import annotations

import frappe


@frappe.whitelist()
def get_list(
    search: str | None = None,
    category_type: str | None = None,
    department_name: str | None = None,
    row_type: str | None = None,
    is_abstract: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Список Catalog Work Item с фильтрами и поиском.

    Возвращает {items, total, has_more}.
    """
    frappe.has_permission("Catalog Work Item", throw=True)
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    where_parts = ["1=1"]
    params: dict = {}

    if search and search.strip():
        s = f"%{search.strip()}%"
        where_parts.append("(rate_name LIKE %(s)s OR rate_code LIKE %(s)s OR work_composition_text LIKE %(s)s)")
        params["s"] = s
    if category_type:
        where_parts.append("category_type = %(cat)s")
        params["cat"] = category_type
    if department_name:
        where_parts.append("department_name = %(dep)s")
        params["dep"] = department_name
    if row_type:
        where_parts.append("row_type = %(rt)s")
        params["rt"] = row_type
    if is_abstract is not None and str(is_abstract) != "":
        where_parts.append("is_abstract = %(ia)s")
        params["ia"] = int(is_abstract)

    where = " AND ".join(where_parts)

    total = frappe.db.sql(f"SELECT COUNT(*) FROM `tabCatalog Work Item` WHERE {where}", params)[0][0]

    rows = frappe.db.sql(
        f"""SELECT name, rate_code, rate_name, rate_unit,
                   category_type, department_name, section_name, subsection_name,
                   row_type, is_scope, is_abstract, usage_count
            FROM `tabCatalog Work Item`
            WHERE {where}
            ORDER BY usage_count DESC, rate_code ASC
            LIMIT {limit} OFFSET {offset}""",
        params, as_dict=True,
    )

    return {
        "items": rows,
        "total": int(total),
        "has_more": offset + limit < int(total),
        "limit": limit,
        "offset": offset,
    }


@frappe.whitelist()
def get_detail(name: str) -> dict:
    frappe.has_permission("Catalog Work Item", "read", doc=name, throw=True)
    return frappe.db.sql(
        """SELECT * FROM `tabCatalog Work Item` WHERE name = %(n)s""",
        {"n": name}, as_dict=True,
    )[0] if frappe.db.exists("Catalog Work Item", name) else {}


@frappe.whitelist()
def get_facets() -> dict:
    """Список категорий/отделов/типов с счётчиками для фильтров."""
    frappe.has_permission("Catalog Work Item", throw=True)

    categories = frappe.db.sql(
        """SELECT category_type, COUNT(*) AS cnt
           FROM `tabCatalog Work Item`
           WHERE category_type IS NOT NULL AND category_type != ''
           GROUP BY category_type ORDER BY 2 DESC""",
        as_dict=True,
    )
    departments = frappe.db.sql(
        """SELECT department_name, COUNT(*) AS cnt
           FROM `tabCatalog Work Item`
           WHERE department_name IS NOT NULL AND department_name != ''
           GROUP BY department_name ORDER BY 2 DESC
           LIMIT 50""",
        as_dict=True,
    )
    row_types = frappe.db.sql(
        """SELECT row_type, COUNT(*) AS cnt
           FROM `tabCatalog Work Item`
           WHERE row_type IS NOT NULL AND row_type != ''
           GROUP BY row_type ORDER BY 2 DESC""",
        as_dict=True,
    )
    total = frappe.db.sql("SELECT COUNT(*) FROM `tabCatalog Work Item`")[0][0]

    return {
        "total": int(total),
        "categories": categories,
        "departments": departments,
        "row_types": row_types,
    }
