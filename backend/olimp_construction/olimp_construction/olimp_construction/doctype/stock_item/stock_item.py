from __future__ import annotations

from frappe.model.document import Document
from frappe.utils import flt


class StockItem(Document):
    """Карточка материала. current_qty / avg_price пересчитываются хуками Stock Movement."""

    def before_save(self) -> None:
        self.total_value = flt(self.current_qty) * flt(self.avg_price)
