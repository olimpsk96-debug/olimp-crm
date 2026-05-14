"""Punch List Item — список недоделок и доделок по объекту.

Создаётся после визита заказчика, прораба, инженера. Помогает не забыть устранить
дефекты и доделать «хвосты» перед сдачей объекта.
"""
from __future__ import annotations

import frappe
from frappe.model.document import Document
from frappe.utils import today


class PunchListItem(Document):
    def before_save(self) -> None:
        # Автозаполнение completed_date при переходе в «Выполнено»
        if self.status == "Выполнено" and not self.completed_date:
            self.completed_date = today()

        # Сброс completed_date если статус снова «Открыто»
        if self.status == "Открыто":
            self.completed_date = None
