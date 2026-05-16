from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, today, now_datetime


class ChangeOrder(Document):
    """Change Order — фиксация изменений scope в ходе проекта.

    Логика:
    - Если есть позиции и contractor_amount пустой — пересчитываем из позиций.
    - Авто-проставляем submitted_at / approved_at / rejected_at при смене статуса.
    """

    def before_save(self) -> None:
        # Пересчёт amount по каждой позиции (child before_save в Frappe ненадёжен)
        for it in self.items or []:
            it.amount = flt(it.qty) * flt(it.unit_price)

        # Авто-сумма подрядчика из позиций, если ничего не задано вручную
        if self.items and not flt(self.contractor_amount):
            self.contractor_amount = sum(flt(it.amount) for it in self.items)

        # Авто-даты по смене статуса
        if self.status == "На согласовании" and not self.submitted_at:
            self.submitted_at = today()
            if not self.submitted_by and frappe.session.user:
                self.submitted_by = frappe.session.user

        if self.status == "Одобрен" and not self.approved_at:
            self.approved_at = today()
            # Если согласованная сумма пустая — копируем из заявки подрядчика
            if not flt(self.approved_amount) and flt(self.contractor_amount):
                self.approved_amount = self.contractor_amount

        if self.status == "Отклонён" and not self.rejected_at:
            self.rejected_at = today()

        # Ball-in-Court auto-handoff по статусу
        BALL_FOR_STATUS = {
            "Черновик": "Подрядчик (ОЛИМП)",
            "На согласовании": "ГИП / Технадзор",
            "Одобрен": "Закрыто",
            "Отклонён": "Закрыто",
            "Закрыт": "Закрыто",
        }
        if self.has_value_changed("status"):
            target = BALL_FOR_STATUS.get(self.status)
            if target and self.current_responsible != target:
                self.current_responsible = target
                self.ball_handed_at = now_datetime()
                self.days_with_current = 0
                self.is_overdue = 0
