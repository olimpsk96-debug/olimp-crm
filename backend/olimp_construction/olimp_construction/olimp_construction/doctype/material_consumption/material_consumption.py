from __future__ import annotations

import frappe
from frappe.model.document import Document


class MaterialConsumption(Document):
    def validate(self):
        if not self.stock_item and not (self.material_name_text or "").strip():
            frappe.throw("Укажите либо материал со склада, либо название текстом")
        if self.qty is None or float(self.qty) <= 0:
            frappe.throw("Количество должно быть больше нуля")

        # Если stock_item указан — подтянем имя/единицу/цену для отображения
        if self.stock_item:
            si = frappe.db.get_value(
                "Stock Item", self.stock_item,
                ["item_name", "unit", "avg_price"], as_dict=True,
            )
            if si:
                if not self.material_name_text:
                    self.material_name_text = si.get("item_name")
                if not self.unit:
                    self.unit = si.get("unit")
                if (self.unit_price is None or float(self.unit_price) == 0) and si.get("avg_price"):
                    self.unit_price = si["avg_price"]

    def before_save(self):
        # Сумма
        self.amount = float(self.qty or 0) * float(self.unit_price or 0)
