from __future__ import annotations

from datetime import timedelta

import frappe
from frappe.model.document import Document
from frappe.utils import getdate, nowdate


class EmployeeCertification(Document):
    """Аттестация / удостоверение сотрудника с авто-расчётом статуса."""

    def before_save(self) -> None:
        # Авто-статус по дате expiry
        if not self.expiry_date:
            return
        today = getdate(nowdate())
        expiry = getdate(self.expiry_date)
        days_left = (expiry - today).days

        if self.status == "Архив":
            return  # архивный статус не меняем

        if days_left < 0:
            self.status = "Просрочено"
        elif days_left <= 30:
            self.status = "Истекает скоро"
        else:
            self.status = "Действует"
