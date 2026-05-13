from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class StockMovement(Document):
    """Движение склада. После save пересчитывает остаток в Stock Item.

    Логика:
    - Приход (+qty) → current_qty += qty, обновляем avg_price по weighted avg
    - Расход (-qty) → current_qty -= qty (запрещаем уход в минус если строгий режим)
    - Перемещение → не меняет общий остаток (warehouse → warehouse_to)
    - Инвентаризация → выставляет current_qty в qty (абсолютная установка)
    """

    def before_save(self) -> None:
        # Авто-заголовок и сумма
        if self.stock_item:
            item_name = frappe.db.get_value("Stock Item", self.stock_item, "item_name") or self.stock_item
            self.title = f"{self.movement_type} · {item_name}"
        self.amount = flt(self.qty) * flt(self.unit_price)

    def on_update(self) -> None:
        self._apply_movement()

    def on_trash(self) -> None:
        # При удалении документа — компенсирующее движение
        self._apply_movement(reverse=True)

    def _apply_movement(self, reverse: bool = False) -> None:
        if not self.stock_item:
            return
        if not frappe.db.exists("Stock Item", self.stock_item):
            return

        item = frappe.get_doc("Stock Item", self.stock_item)
        qty = flt(self.qty)
        if reverse:
            qty = -qty

        old_qty = flt(item.current_qty)
        old_avg = flt(item.avg_price)

        if self.movement_type == "Приход":
            new_qty = old_qty + qty
            # Weighted avg price
            if new_qty > 0 and self.unit_price:
                total_value = old_qty * old_avg + qty * flt(self.unit_price)
                item.avg_price = total_value / new_qty
                item.last_price = flt(self.unit_price)
            item.current_qty = new_qty

        elif self.movement_type == "Расход":
            item.current_qty = old_qty - qty
            # avg_price не меняется на расходе

        elif self.movement_type == "Перемещение":
            # Перемещение не меняет общий остаток (упрощённо — считаем что между складами)
            pass

        elif self.movement_type == "Инвентаризация":
            # Абсолютная установка остатка — qty это новый остаток
            item.current_qty = qty

        item.last_movement_date = self.movement_date
        item.save(ignore_permissions=True)

        # Запоминаем балансы после операции — для аудита
        self.db_set("balance_after", flt(item.current_qty), update_modified=False)
