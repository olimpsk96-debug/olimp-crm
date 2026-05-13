from __future__ import annotations
import frappe
from frappe.model.document import Document
from frappe.utils import flt


class ConstructionProject(Document):
    def before_save(self):
        if self.contract_amount and self.planned_cost:
            self.planned_margin_pct = flt(
                (flt(self.contract_amount) - flt(self.planned_cost)) / flt(self.contract_amount) * 100,
                2,
            )
