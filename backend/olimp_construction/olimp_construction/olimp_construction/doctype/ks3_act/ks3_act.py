from __future__ import annotations
import frappe
from frappe.model.document import Document
from frappe.utils import flt, nowdate


class KS3Act(Document):
    def before_save(self):
        self._recalc_totals()
        self._sync_linked_acts()
        if self.status == "Подписан" and not self.signed_date:
            self.signed_date = nowdate()

    def _recalc_totals(self):
        total_period = sum(flt(i.cost_period) for i in (self.items or []))
        total_since_year = sum(flt(i.cost_since_year) for i in (self.items or []))
        total_since_start = sum(flt(i.cost_since_start) for i in (self.items or []))

        self.total_period = total_period
        self.total_since_year = total_since_year
        self.total_since_start = total_since_start

        vat = flt(total_period) * flt(self.vat_rate or 0) / 100
        self.vat_amount = vat
        self.total_with_vat = total_period + vat

        retention = flt(self.total_with_vat) * flt(self.retention_pct or 0) / 100
        self.retention_amount = retention
        self.total_to_pay = self.total_with_vat - retention

    def _sync_linked_acts(self):
        """Подтягивает данные КС-2 в дочернюю таблицу."""
        for row in (self.ks2_acts or []):
            if not row.ks2_act:
                continue
            ks2 = frappe.db.get_value(
                "KS2 Act", row.ks2_act,
                ["act_number", "act_date", "amount"], as_dict=True,
            )
            if ks2:
                row.act_number = ks2.act_number
                row.act_date = ks2.act_date
                row.act_amount = ks2.amount
