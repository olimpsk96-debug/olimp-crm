from __future__ import annotations

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class MaterialRequest(Document):
    def before_save(self) -> None:
        self._calculate_amounts()

    def _calculate_amounts(self) -> None:
        total = 0.0
        for item in self.items or []:
            item.amount_estimated = flt(item.qty) * flt(item.unit_price_estimated)
            total += item.amount_estimated
        self.total_estimated = flt(total, 2)
