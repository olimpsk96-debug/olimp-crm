import json

import frappe
from frappe.model.document import Document


class PDFAnnotation(Document):
    def before_save(self):
        # Считаем количество аннотаций
        try:
            data = json.loads(self.annotations_json or "[]")
            if isinstance(data, list):
                self.annotation_count = len(data)
        except (json.JSONDecodeError, TypeError):
            self.annotation_count = 0
