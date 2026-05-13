import frappe
from frappe.model.document import Document
from frappe.utils import flt, today


class FuelLog(Document):
    def before_save(self):
        self.total_amount = flt(self.liters) * flt(self.price_per_liter)
        if not self.fuel_date:
            self.fuel_date = today()
        if self.odometer_reading and self.equipment:
            frappe.db.set_value("Equipment", self.equipment, "odometer", self.odometer_reading)
        if self.engine_hours_reading and self.equipment:
            frappe.db.set_value("Equipment", self.equipment, "engine_hours", self.engine_hours_reading)
