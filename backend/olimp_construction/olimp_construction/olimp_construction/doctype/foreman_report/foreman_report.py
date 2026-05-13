import frappe
from frappe.model.document import Document
from frappe.utils import today


class ForemanReport(Document):
    def before_save(self):
        if not self.report_date:
            self.report_date = today()
        if not self.title:
            self.title = f"Отчёт {self.foreman_name or 'прораба'} — {self.report_date}"
