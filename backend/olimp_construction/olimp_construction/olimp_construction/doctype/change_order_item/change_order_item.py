from __future__ import annotations

from frappe.model.document import Document
from frappe.utils import flt


class ChangeOrderItem(Document):
    """Позиция Change Order. amount = qty × unit_price (qty может быть отрицательным)."""

    def before_save(self) -> None:
        self.amount = flt(self.qty) * flt(self.unit_price)
