import frappe
from frappe.model.document import Document


class UserView(Document):
    def before_save(self):
        if not self.user_email:
            self.user_email = frappe.session.user
