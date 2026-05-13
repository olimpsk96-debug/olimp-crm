import frappe
from frappe.model.document import Document
from frappe.utils import flt


class Equipment(Document):
    def before_save(self):
        self._calculate_book_value()

    def _calculate_book_value(self):
        if not self.purchase_price or not self.year_of_manufacture:
            return
        from frappe.utils import getdate, nowdate
        age_years = getdate(nowdate()).year - int(self.year_of_manufacture)
        rate = flt(self.depreciation_rate_pct or 10) / 100
        factor = max(0.0, 1.0 - rate * age_years)
        self.book_value = flt(self.purchase_price) * factor
