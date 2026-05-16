from __future__ import annotations
import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class Deal(Document):
    def before_save(self):
        # Обновляем last_activity_date при любом сохранении (смена статуса, заметки и т.д.)
        if self.has_value_changed("status") or self.is_new():
            self.last_activity_date = now_datetime()

        # При статусе «Закрыт проигран» — требуем loss_reason
        if self.status == "Закрыт проигран" and not self.loss_reason:
            frappe.throw("При статусе «Закрыт проигран» нужно указать причину (loss_reason)")

        # Подставляем дефолтный probability_pct по статусу если 0
        DEFAULT_PROBABILITY = {
            "Лид":            10,
            "Переговоры":     30,
            "КП отправлено":  50,
            "Договор":        80,
            "В работе":       95,
            "Закрыт выигран": 100,
            "Закрыт проигран": 0,
        }
        if self.has_value_changed("status") and not self.probability_pct:
            self.probability_pct = DEFAULT_PROBABILITY.get(self.status, 30)
