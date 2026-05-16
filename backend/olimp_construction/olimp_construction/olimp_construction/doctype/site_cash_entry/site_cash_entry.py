from __future__ import annotations

import frappe
from frappe.model.document import Document


class SiteCashEntry(Document):
    def validate(self):
        if self.amount is not None and float(self.amount) <= 0:
            frappe.throw("Сумма должна быть больше нуля")
        if self.status == "Отклонён" and not (self.rejection_reason or "").strip():
            frappe.throw("Укажите причину отклонения")
