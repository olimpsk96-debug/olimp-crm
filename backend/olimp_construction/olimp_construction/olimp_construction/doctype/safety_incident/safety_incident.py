import frappe
from frappe.model.document import Document
from frappe.utils import today


class SafetyIncident(Document):
    def before_save(self):
        if not self.incident_date:
            self.incident_date = today()
        if self.status == "Закрыт" and not self.resolved_date:
            self.resolved_date = today()
