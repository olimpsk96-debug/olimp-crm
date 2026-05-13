from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class Estimate(Document):
    def before_save(self) -> None:
        self._calculate_item_amounts()
        self._calculate_totals()

    def _calculate_item_amounts(self) -> None:
        for item in self.items or []:
            if item.is_section:
                continue
            item.base_amount = flt(item.qty) * flt(item.base_unit_price)
            item.our_amount = flt(item.qty) * flt(item.our_unit_price or item.base_unit_price)
            if item.base_amount:
                item.deviation_pct = flt(
                    (item.our_amount - item.base_amount) / item.base_amount * 100, 2
                )
            else:
                item.deviation_pct = 0

    def _calculate_totals(self) -> None:
        base_total = sum(flt(i.base_amount) for i in (self.items or []) if not i.is_section)
        our_total = sum(flt(i.our_amount) for i in (self.items or []) if not i.is_section)

        overhead = flt(self.overhead_pct) / 100
        profit = flt(self.profit_pct) / 100

        self.base_total = flt(base_total * (1 + overhead + profit), 2)
        self.our_total = flt(our_total * (1 + overhead + profit), 2)

        if self.our_total and self.base_total:
            self.margin_amount = flt(self.our_total - self.base_total, 2)
            self.margin_pct = flt(self.margin_amount / self.our_total * 100, 2)
        else:
            self.margin_amount = 0
            self.margin_pct = 0
