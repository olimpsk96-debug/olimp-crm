"""Тендер на субподряд: посчёт сумм и сводок в before_save родителя.

Child before_save в Frappe срабатывает не всегда (см. CLAUDE.md р.18 от 2026-05-13),
поэтому считаем `our_amount` по позициям и `total_target_amount` здесь.
"""
import frappe
from frappe.model.document import Document
from frappe.utils import flt


class SubcontractBidRequest(Document):
    def before_save(self):
        total = 0.0
        for it in (self.items or []):
            it.our_amount = flt(it.qty) * flt(it.our_unit_price)
            total += it.our_amount
        self.total_target_amount = total

        # Сводка по предложениям (если уже есть)
        proposals = frappe.get_all(
            "Subcontract Proposal",
            filters={"bid_request": self.name},
            fields=["name", "total_amount", "status"],
        )
        self.proposals_count = len(proposals)
        active = [p for p in proposals if p["status"] not in ("Отклонено",)]
        if active:
            best = min(active, key=lambda p: flt(p["total_amount"]) or float("inf"))
            self.best_proposal_amount = flt(best["total_amount"])
            self.savings_amount = max(0.0, flt(self.total_target_amount) - flt(self.best_proposal_amount))
            if flt(self.total_target_amount) > 0:
                self.savings_pct = self.savings_amount / flt(self.total_target_amount) * 100.0
            else:
                self.savings_pct = 0.0
        else:
            self.best_proposal_amount = 0.0
            self.savings_amount = 0.0
            self.savings_pct = 0.0
