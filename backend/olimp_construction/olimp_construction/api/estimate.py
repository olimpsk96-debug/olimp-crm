from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import now_datetime


@frappe.whitelist()
def get_list(project: str | None = None, tender: str | None = None) -> list[dict]:
    """Список смет с фильтрами по проекту / тендеру."""
    frappe.has_permission("Estimate", throw=True)

    filters: dict = {}
    if project:
        filters["project"] = project
    if tender:
        filters["tender"] = tender

    return frappe.get_all(
        "Estimate",
        filters=filters,
        fields=[
            "name", "title", "status", "version",
            "project", "tender", "estimate_date",
            "base_total", "our_total",
            "margin_pct", "margin_amount",
            "overhead_pct", "profit_pct",
            "import_source", "imported_at",
        ],
        order_by="modified desc",
        limit=200,
    )


@frappe.whitelist()
def get_detail(name: str) -> dict:
    """Смета со всеми позициями."""
    frappe.has_permission("Estimate", "read", throw=True)
    doc = frappe.get_doc("Estimate", name)
    result = doc.as_dict()
    return result


@frappe.whitelist()
def save_estimate(data: dict) -> dict:
    """Создать или обновить смету (upsert по name)."""
    frappe.has_permission("Estimate", "create", throw=True)

    name = data.get("name")
    if name and frappe.db.exists("Estimate", name):
        doc = frappe.get_doc("Estimate", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"updated": doc.name}
    else:
        doc = frappe.get_doc({"doctype": "Estimate", **data})
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return {"created": doc.name}


@frappe.whitelist()
def import_from_gs_xml(
    xml_content: str,
    tender: str | None = None,
    project: str | None = None,
    estimate_name: str | None = None,
) -> dict:
    """Импорт сметы из XML-файла Гранд-Сметы (формат GrandSmeta v12.x).

    Поддерживает:
    - Декодирование windows-1251 (если xml_content приходит как bytes/str с CP1251)
    - Заголовки разделов из <Chapter Caption="..."/>
    - Позиции из <Position Caption Code Units> + <Quantity Result="..."> + <PriceBase PZ="...">
    - Индекс пересчёта SMR из <Indexes><IndexesPos><Index SMR="..."/></IndexesPos></Indexes>
      → цена в текущих ценах = PZ × SMR
    - Понижающий договорной коэффициент из <AddZatrats> с Options="AsKf" → применяется к our_unit_price

    Если estimate_name передан и существует — заменяет позиции в той смете.
    Иначе создаёт новую смету. Возвращает {"created"|"updated", "items_count", "summary"}.
    """
    frappe.has_permission("Estimate", "create", throw=True)

    try:
        # defusedxml защищает от XXE, Billion Laughs и external entity атак —
        # критично для импорта файлов от заказчика.
        from defusedxml.ElementTree import fromstring as defused_fromstring
        # Поддержка bytes (например, прочитан как windows-1251)
        if isinstance(xml_content, bytes):
            try:
                xml_content = xml_content.decode("utf-8")
            except UnicodeDecodeError:
                xml_content = xml_content.decode("windows-1251")
        # Убираем declaration encoding, чтобы парсер не пытался применять её к unicode
        if isinstance(xml_content, str) and xml_content.lstrip().startswith("<?xml"):
            import re
            xml_content = re.sub(r'\?>\s*', '?>', xml_content, count=1)
            xml_content = re.sub(r'encoding="[^"]+"', 'encoding="utf-8"', xml_content, count=1)
        root = defused_fromstring(xml_content)
    except Exception as e:
        frappe.throw(f"Ошибка парсинга XML: {e}")

    smr_index = _extract_smr_index(root)
    discount_pct = _extract_discount(root)  # отрицательный = скидка
    items = _parse_gs_xml(root, smr_index=smr_index, discount_pct=discount_pct)
    if not items:
        frappe.throw("Позиции в XML не найдены. Проверьте формат файла.")

    title = _extract_title(root) or "Импортированная смета"

    summary = {
        "smr_index": smr_index,
        "discount_pct": discount_pct,
        "rows": sum(1 for it in items if not it.get("is_section")),
        "sections": sum(1 for it in items if it.get("is_section")),
    }

    if estimate_name and frappe.db.exists("Estimate", estimate_name):
        doc = frappe.get_doc("Estimate", estimate_name)
        doc.items = []
        for item in items:
            doc.append("items", item)
        doc.import_source = "Гранд-Смета XML"
        doc.imported_at = now_datetime()
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"updated": doc.name, "items_count": len(items), "summary": summary}

    doc = frappe.get_doc({
        "doctype": "Estimate",
        "title": title,
        "status": "Базовая",
        "import_source": "Гранд-Смета XML",
        "imported_at": now_datetime(),
        "tender": tender,
        "project": project,
        "items": items,
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"created": doc.name, "items_count": len(items), "summary": summary}


def _extract_title(root) -> str | None:
    """Название из <Properties Description="..."/> или fallback'ов."""
    props = root.find(".//Properties")
    if props is not None:
        desc = props.get("Description") or props.get("Caption") or props.get("ObjectName")
        if desc:
            return desc.strip()
    for tag in ("Title", "Name", "ObjectName", "Наименование"):
        el = root.find(f".//{tag}")
        if el is not None and el.text:
            return el.text.strip()
    return None


def _extract_smr_index(root) -> float:
    """Индекс пересчёта из 2001г в текущие цены. Default 1.0 если не найден."""
    idx = root.find(".//Indexes/IndexesPos/Index")
    if idx is None:
        return 1.0
    return _safe_float(idx.get("SMR") or idx.get("Smr") or idx.get("Value"), default=1.0)


def _extract_discount(root) -> float:
    """Понижающий договорной коэффициент из <AddZatrats> (Options содержит 'AsKf').

    Возвращает в процентах (отрицательное значение = скидка).
    """
    for az in root.findall(".//AddZatrats/AddZatrGlava/AddZatr"):
        options = az.get("Options", "")
        if "AsKf" in options and "Inactive" not in options:
            return _safe_float(az.get("Value"), default=0.0)
    return 0.0


def _parse_gs_xml(root, smr_index: float = 1.0, discount_pct: float = 0.0) -> list[dict]:
    """Парсит XML Гранд-Сметы (GrandSmeta v12.x) и возвращает список позиций.

    Цена в текущих ценах = PriceBase.PZ × smr_index
    Наша цена = current × (1 + discount_pct/100)
    """
    items: list[dict] = []
    discount_factor = 1.0 + (discount_pct / 100.0)

    chapters = root.find("Chapters")
    if chapters is None:
        return items

    for chapter in chapters.findall("Chapter"):
        section_title = chapter.get("Caption") or chapter.get("Name") or "Раздел"
        items.append({
            "is_section": 1,
            "section_title": section_title,
            "item_name": section_title,
        })

        for child in list(chapter):
            tag = child.tag
            if tag != "Position":
                # Header и прочие разделители — пропускаем
                continue

            name = (child.get("Caption") or "").strip()
            if not name:
                continue
            code = (child.get("Code") or "").strip()
            unit = (child.get("Units") or child.get("Unit") or "").strip()

            # Объём: предпочитаем <Quantity Result="..."> (надёжное вычисленное значение)
            qty_node = child.find("Quantity")
            if qty_node is not None and qty_node.get("Result") is not None:
                qty = _safe_float(qty_node.get("Result"))
            else:
                # Если в атрибуте позиции — простое число (без формулы)
                raw_qty = child.get("Quantity")
                qty = _safe_float(raw_qty) if raw_qty and _is_simple_number(raw_qty) else 0.0

            # Базовая цена в 2001г: <PriceBase PZ="..."/>
            price_base = child.find("PriceBase")
            pz_2001 = _safe_float(price_base.get("PZ")) if price_base is not None else 0.0

            base_unit_price = pz_2001 * smr_index  # цена 2001 → в текущие
            our_unit_price = base_unit_price * discount_factor  # с понижающим коэффициентом

            comment = (child.get("Comment") or "").strip()
            notes_parts = [p for p in [comment, child.get("DBComment", "").strip()] if p]

            items.append({
                "is_section": 0,
                "item_code": code,
                "item_name": name,
                "unit": unit,
                "qty": qty,
                "base_unit_price": base_unit_price,
                "our_unit_price": our_unit_price,
                "notes": " · ".join(notes_parts) if notes_parts else None,
            })

    return items


def _is_simple_number(value: str) -> bool:
    """True если строка — простое число (без формул вида '100/1000' или 'ОКР(...)')."""
    if not value:
        return False
    s = value.strip().replace(",", ".").replace(" ", "")
    try:
        float(s)
        return True
    except ValueError:
        return False


def _safe_float(value, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(str(value).replace(" ", "").replace(",", "."))
    except (ValueError, TypeError):
        return default
