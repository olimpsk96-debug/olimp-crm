"""Предложение от субподрядчика на тендер: считаем сумму + сравниваем с нашей оценкой."""
import frappe
from frappe.model.document import Document
from frappe.utils import flt


class SubcontractProposal(Document):
    def before_save(self):
        # Snapshot названия поставщика — на случай переименования Supplier позже
        if self.supplier and not self.supplier_name_snapshot:
            self.supplier_name_snapshot = frappe.db.get_value(
                "Supplier", self.supplier, "supplier_name"
            ) or self.supplier

        # Расчёт сумм по позициям
        total = 0.0
        for it in (self.items or []):
            it.supplier_amount = flt(it.qty) * flt(it.supplier_unit_price)
            total += it.supplier_amount
        self.total_amount = total

        # Сравнение с целевой ценой Bid Request
        if self.bid_request:
            target = flt(frappe.db.get_value(
                "Subcontract Bid Request", self.bid_request, "total_target_amount"
            ))
            if target > 0:
                self.vs_target_pct = (total / target) * 100.0
            else:
                self.vs_target_pct = 0.0

    def on_update(self):
        # Триггерим пересчёт сводок в родительском Bid Request
        if self.bid_request and frappe.db.exists("Subcontract Bid Request", self.bid_request):
            br = frappe.get_doc("Subcontract Bid Request", self.bid_request)
            br.save(ignore_permissions=True)
