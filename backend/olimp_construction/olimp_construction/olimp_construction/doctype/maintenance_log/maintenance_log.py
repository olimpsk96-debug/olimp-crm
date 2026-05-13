import frappe
from frappe.model.document import Document
from frappe.utils import flt, today


class MaintenanceLog(Document):
    def before_save(self):
        self.total_cost = flt(self.cost_labor) + flt(self.cost_parts)
        if not self.maintenance_date:
            self.maintenance_date = today()

    def on_update(self):
        if self.next_maintenance_date and self.equipment:
            frappe.db.set_value(
                "Equipment", self.equipment,
                "next_maintenance_date", self.next_maintenance_date
            )
            frappe.db.commit()
