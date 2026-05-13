from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, now_datetime


ACTIVE_STATUSES = ("Новый", "Оценивается", "Готовится заявка")
TERMINAL_STATUSES = ("Выиграли", "Проиграли", "Отклонён")


class Tender(Document):
    def validate(self) -> None:
        self._sync_status_with_result()
        self._validate_deadline()
        self._validate_price()
        self._validate_win_amount()
        self._validate_submission_date()
        self._calculate_margin()

    def _validate_deadline(self) -> None:
        """Предупреждает если дедлайн уже прошёл для активного тендера."""
        if not self.deadline_date:
            return
        if getdate(self.deadline_date) < getdate() and self.status in ACTIVE_STATUSES:
            frappe.msgprint(
                _("Дедлайн подачи уже прошёл ({0}). Проверьте статус тендера.").format(
                    self.deadline_date
                ),
                indicator="orange",
                alert=True,
            )

    def _validate_price(self) -> None:
        """Наша цена не должна превышать НМЦК."""
        if self.nmck and self.our_price and self.our_price > self.nmck:
            frappe.throw(
                _("Наша цена ({0} ₽) не может превышать НМЦК ({1} ₽)").format(
                    frappe.format_value(self.our_price, {"fieldtype": "Currency"}),
                    frappe.format_value(self.nmck, {"fieldtype": "Currency"}),
                )
            )

    def _validate_win_amount(self) -> None:
        """При статусе «Выиграли» сумма контракта обязательна."""
        if self.status == "Выиграли" and not self.win_amount:
            frappe.throw(
                _("Укажите сумму контракта (поле «Сумма контракта») для выигранного тендера")
            )

    def _validate_submission_date(self) -> None:
        """При статусе «Заявка подана» дата подачи обязательна."""
        if self.status == "Заявка подана" and not self.submission_date:
            frappe.throw(
                _("Укажите дату подачи заявки (поле «Дата подачи заявки»)")
            )

    def _calculate_margin(self) -> None:
        """Автоматически рассчитывает маржу если заданы НМЦК и наша цена."""
        if self.nmck and self.our_price and self.our_price > 0:
            self.margin_pct = round((self.nmck - self.our_price) / self.nmck * 100, 1)
        elif not self.our_price:
            self.margin_pct = None

    def _sync_status_with_result(self) -> None:
        """Синхронизирует статус с полем result при прямом заполнении итога."""
        if self.result == "Выиграли" and self.status not in ("Выиграли",):
            self.status = "Выиграли"
        elif self.result == "Проиграли" and self.status not in ("Проиграли",):
            self.status = "Проиграли"

    def on_update(self) -> None:
        if self.has_value_changed("status"):
            self._notify_status_change()
            if self.status == "Выиграли":
                self._auto_create_project()

    def _auto_create_project(self) -> None:
        """При выигрыше тендера автоматически создаёт Construction Project."""
        existing = frappe.db.exists("Construction Project", {"tender": self.name})
        if existing:
            return
        if not self.customer:
            return
        project = frappe.new_doc("Construction Project")
        project.title = self.title or self.name
        project.status = "Подготовка"
        project.customer = self.customer
        project.tender = self.name
        project.work_type = self.work_type
        project.contract_amount = self.win_amount or self.our_price or self.nmck or 0
        project.description = f"Проект создан автоматически из тендера {self.name}"
        project.insert(ignore_permissions=True)
        frappe.msgprint(
            _("Создан проект {0}").format(project.name),
            indicator="green",
            alert=True,
        )

    def _notify_status_change(self) -> None:
        frappe.publish_realtime(
            event="tender_status_changed",
            message={"tender": self.name, "status": self.status, "title": self.title},
            room=f"user:{frappe.session.user}",
        )
