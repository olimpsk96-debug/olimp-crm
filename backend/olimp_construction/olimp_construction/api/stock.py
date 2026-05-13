"""API склада: Stock Item / Stock Movement.

Бизнес-логика остатков лежит в DocType.on_update (см. stock_movement.py).
Здесь только read-API + хелперы для UI + связка с Material Request.
"""
from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate


@frappe.whitelist()
def get_items(
    category: str | None = None,
    search: str | None = None,
    low_stock_only: bool = False,
    limit: int = 200,
) -> list[dict]:
    """Список карточек материалов с фильтрами."""
    frappe.has_permission("Stock Item", throw=True)

    filters: dict = {}
    if category:
        filters["category"] = category

    or_filters = {}
    if search:
        or_filters = {
            "item_name": ["like", f"%{search}%"],
            "item_code": ["like", f"%{search}%"],
        }

    items = frappe.get_all(
        "Stock Item",
        filters=filters,
        or_filters=or_filters,
        fields=[
            "name", "item_name", "item_code", "category", "unit",
            "default_warehouse", "current_qty", "min_qty",
            "last_price", "avg_price", "total_value", "last_movement_date",
        ],
        order_by="item_name asc",
        limit=int(limit),
    )

    if low_stock_only:
        items = [it for it in items if flt(it.get("current_qty")) <= flt(it.get("min_qty") or 0)]

    for it in items:
        it["is_low"] = flt(it.get("current_qty")) <= flt(it.get("min_qty") or 0) and flt(it.get("min_qty") or 0) > 0

    return items


@frappe.whitelist()
def get_item_detail(name: str) -> dict:
    """Карточка материала + история последних 30 движений."""
    frappe.has_permission("Stock Item", "read", throw=True)
    item = frappe.get_doc("Stock Item", name).as_dict()

    movements = frappe.get_all(
        "Stock Movement",
        filters={"stock_item": name},
        fields=[
            "name", "title", "movement_type", "movement_date",
            "qty", "unit_price", "amount", "warehouse", "warehouse_to",
            "project", "material_request", "supplier_name", "invoice_number",
            "responsible", "balance_after", "notes",
        ],
        order_by="movement_date desc, creation desc",
        limit=30,
    )
    item["movements"] = movements
    return item


@frappe.whitelist()
def save_item(data: dict) -> dict:
    """Создать или обновить Stock Item."""
    frappe.has_permission("Stock Item", "create", throw=True)
    name = data.get("name")
    if name and frappe.db.exists("Stock Item", name):
        doc = frappe.get_doc("Stock Item", name)
        doc.update(data)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"updated": doc.name}
    doc = frappe.get_doc({"doctype": "Stock Item", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"created": doc.name}


@frappe.whitelist()
def save_movement(data: dict) -> dict:
    """Создать движение склада."""
    frappe.has_permission("Stock Movement", "create", throw=True)
    doc = frappe.get_doc({"doctype": "Stock Movement", **data})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"created": doc.name, "balance_after": flt(doc.balance_after)}


@frappe.whitelist()
def get_stats() -> dict:
    """Сводка по складу для дашборда."""
    frappe.has_permission("Stock Item", throw=True)

    total_items = frappe.db.count("Stock Item")
    if total_items == 0:
        return {"total_items": 0, "total_value": 0, "low_stock": 0, "by_category": []}

    total_value = flt(frappe.db.sql(
        "SELECT IFNULL(SUM(current_qty * avg_price), 0) FROM `tabStock Item`"
    )[0][0])

    # Low stock: текущий остаток <= min_qty (при min_qty > 0)
    low_stock = frappe.db.sql(
        """SELECT COUNT(*) FROM `tabStock Item`
           WHERE min_qty > 0 AND current_qty <= min_qty"""
    )[0][0]

    by_category = frappe.db.sql(
        """SELECT category, COUNT(*) cnt,
                  IFNULL(SUM(current_qty * avg_price), 0) value
           FROM `tabStock Item`
           WHERE category IS NOT NULL AND category != ''
           GROUP BY category ORDER BY cnt DESC""",
        as_dict=True,
    )

    # Последние 5 движений
    recent = frappe.get_all(
        "Stock Movement",
        fields=["name", "title", "movement_type", "movement_date", "qty", "amount", "project"],
        order_by="movement_date desc, creation desc",
        limit=5,
    )

    # Топ 5 самых дефицитных (положительный min_qty и low stock)
    short = frappe.db.sql(
        """SELECT name, item_name, unit, current_qty, min_qty, (min_qty - current_qty) as deficit
           FROM `tabStock Item`
           WHERE min_qty > 0 AND current_qty <= min_qty
           ORDER BY deficit DESC LIMIT 5""",
        as_dict=True,
    )

    return {
        "total_items": int(total_items),
        "total_value": total_value,
        "low_stock": int(low_stock),
        "by_category": by_category,
        "recent_movements": recent,
        "short_items": short,
    }


# ────────────────────────── Связь с Material Request ───────────────────────


def _find_stock_item_for(item_name: str, unit: str | None = None) -> str | None:
    """Ищет Stock Item по наименованию (точное → fuzzy).

    Возвращает name найденного Stock Item или None.
    """
    if not item_name:
        return None

    # 1. Точное совпадение по item_name
    exact = frappe.db.get_value("Stock Item", {"item_name": item_name}, "name")
    if exact:
        return exact

    # 2. Fuzzy через rapidfuzz
    try:
        from rapidfuzz import fuzz, process
    except ImportError:
        return None

    all_items = frappe.get_all("Stock Item", fields=["name", "item_name", "unit"], limit=2000)
    if not all_items:
        return None

    matches = process.extract(
        item_name,
        {i: f"{it['item_name']}" for i, it in enumerate(all_items)},
        scorer=fuzz.WRatio,
        limit=3,
    )
    for _matched_str, score, idx in matches:
        if score >= 85:
            # Дополнительно сверяем unit, если задан
            if unit and all_items[idx].get("unit") and all_items[idx]["unit"] != unit:
                continue
            return all_items[idx]["name"]
    return None


@frappe.whitelist()
def preview_receipt_from_mr(mr_name: str) -> dict:
    """Предпросмотр оприходования по Material Request.

    Возвращает список позиций с предложенным маппингом на Stock Item
    (existing или будет создан новый). Не создаёт записи.
    """
    frappe.has_permission("Material Request", "read", doc=mr_name, throw=True)

    if not frappe.db.exists("Material Request", mr_name):
        frappe.throw(_(f"Material Request {mr_name} не найдена"))

    mr = frappe.get_doc("Material Request", mr_name)
    existing = frappe.db.count("Stock Movement", {"material_request": mr_name})

    rows = []
    for it in mr.items or []:
        stock_item = _find_stock_item_for(it.item_name, it.unit)
        current_qty = 0.0
        match_type = "Создаётся новый"
        if stock_item:
            current_qty = flt(frappe.db.get_value("Stock Item", stock_item, "current_qty"))
            match_type = "Точное совпадение" if frappe.db.get_value(
                "Stock Item", stock_item, "item_name") == it.item_name else "Fuzzy-совпадение"
        rows.append({
            "item_name": it.item_name,
            "specification": getattr(it, "specification", None),
            "unit": it.unit,
            "qty": flt(it.qty),
            "unit_price": flt(getattr(it, "unit_price_estimated", 0)),
            "amount": flt(getattr(it, "amount_estimated", 0)),
            "stock_item": stock_item,
            "stock_item_current_qty": current_qty,
            "match_type": match_type,
        })

    return {
        "mr": mr_name,
        "mr_title": mr.title,
        "mr_status": mr.status,
        "project": mr.project,
        "supplier_suggestion": getattr(mr, "supplier_name", None) or "",
        "items": rows,
        "existing_movements": existing,
        "can_receive": existing == 0 and mr.status in ("Получена", "Закупается"),
    }


@frappe.whitelist()
def receive_material_request(mr_name: str, supplier_name: str = "", invoice_number: str = "", responsible: str = "") -> dict:
    """Оприходует материалы по Material Request.

    Для каждой позиции:
    1. Ищет Stock Item (exact или fuzzy ≥85%)
    2. Если не нашёл — создаёт новую карточку Stock Item
    3. Создаёт Stock Movement (Приход) с балансом
    4. Связывает с MR через поле material_request
    """
    frappe.has_permission("Material Request", "write", doc=mr_name, throw=True)
    frappe.has_permission("Stock Movement", "create", throw=True)

    if not frappe.db.exists("Material Request", mr_name):
        frappe.throw(_(f"Material Request {mr_name} не найдена"))

    # Защита от повторного оприходования
    existing = frappe.db.count("Stock Movement", {"material_request": mr_name})
    if existing > 0:
        frappe.throw(_(f"По заявке {mr_name} уже создано {existing} движений склада"))

    mr = frappe.get_doc("Material Request", mr_name)
    today = frappe.utils.nowdate()

    created_items: list[dict] = []
    for it in mr.items or []:
        stock_item_name = _find_stock_item_for(it.item_name, it.unit)
        was_created = False

        if not stock_item_name:
            # Создаём новую карточку
            new_si = frappe.get_doc({
                "doctype": "Stock Item",
                "item_name": it.item_name,
                "unit": it.unit or "шт",
                "category": "Прочее",
                "default_warehouse": "Основной склад",
                "min_qty": 0,
                "notes": f"Создано из {mr_name}",
            })
            new_si.insert(ignore_permissions=True)
            stock_item_name = new_si.name
            was_created = True

        # Создаём приход
        movement = frappe.get_doc({
            "doctype": "Stock Movement",
            "movement_type": "Приход",
            "movement_date": today,
            "stock_item": stock_item_name,
            "qty": flt(it.qty),
            "unit_price": flt(getattr(it, "unit_price_estimated", 0)),
            "warehouse": "Основной склад",
            "project": mr.project,
            "material_request": mr_name,
            "supplier_name": supplier_name or getattr(mr, "supplier_name", "") or "",
            "invoice_number": invoice_number,
            "responsible": responsible,
            "notes": f"Авто-оприходование по заявке {mr_name}",
        })
        movement.insert(ignore_permissions=True)

        created_items.append({
            "item_name": it.item_name,
            "stock_item": stock_item_name,
            "qty": flt(it.qty),
            "movement": movement.name,
            "was_created": was_created,
        })

    frappe.db.commit()

    return {
        "ok": True,
        "mr": mr_name,
        "items_received": len(created_items),
        "new_stock_items": sum(1 for i in created_items if i["was_created"]),
        "items": created_items,
    }


def on_material_request_received(doc, method: str | None = None) -> None:
    """Хук Material Request.on_update: при смене статуса на 'Получена' логирует и пушит в Telegram.

    Не создаёт Stock Movement автоматически (это требует решения о поставщике/накладной),
    но напоминает Диме что нужно нажать «Оприходовать на склад».
    """
    try:
        if not doc or not getattr(doc, "status", None):
            return
        if doc.status != "Получена":
            return
        existing = frappe.db.count("Stock Movement", {"material_request": doc.name})
        if existing > 0:
            return  # уже оприходовано

        from olimp_construction.telegram_utils import send_message
        text = (
            f"📦 <b>Заявка {doc.name} получена</b>\n"
            f"{doc.title}\n"
            f"Позиций: {len(doc.items or [])}, сумма ~{flt(getattr(doc, 'total_estimated', 0)):,.0f} ₽\n\n"
            f"Откройте заявку и нажмите «Оприходовать на склад»"
        )
        send_message(text)
        frappe.logger().info(f"MR {doc.name} received → Telegram alert sent")
    except Exception:
        frappe.log_error(frappe.get_traceback(), "on_material_request_received")
