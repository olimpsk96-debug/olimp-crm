import frappe
from frappe.model.document import Document


class WorkTemplate(Document):
    def validate(self):
        # Нормализуем stage_order
        for idx, stage in enumerate(self.stages or [], start=1):
            if not stage.stage_order:
                stage.stage_order = idx

    def increment_usage(self):
        """Вызывается из API decompose_work при использовании шаблона."""
        self.db_set("usage_count", (self.usage_count or 0) + 1, update_modified=False)
