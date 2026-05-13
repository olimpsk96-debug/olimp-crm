from __future__ import annotations

from frappe.model.document import Document
from frappe.utils import flt


class KS2Act(Document):
    def before_save(self) -> None:
        self._calculate_amounts()
        if self.status == "Подписан" and not self.signed_date:
            from frappe.utils import today
            self.signed_date = today()

    def _calculate_amounts(self) -> None:
        total = 0.0
        for item in self.items or []:
            item.amount = flt(item.qty) * flt(item.unit_price)
            total += item.amount
        self.amount = flt(total, 2)
