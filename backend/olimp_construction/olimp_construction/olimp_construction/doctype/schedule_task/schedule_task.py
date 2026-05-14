"""Schedule Task — задача в графике работ проекта.

Авторасчёт duration_days в before_save (end - start + 1).
Для разделов (is_section=1) end_date / duration вычисляются как min/max детей через
on_update сводок — это делается в api/schedule.py при загрузке списка
(тяжёлый каскад в БД не нужен — все задачи проекта обычно <100).
"""
import frappe
from frappe.model.document import Document
from frappe.utils import getdate, flt


class ScheduleTask(Document):
    def validate(self):
        if self.start_date and self.end_date and getdate(self.end_date) < getdate(self.start_date):
            frappe.throw("Дата окончания не может быть раньше даты начала")
        if self.parent_task and self.parent_task == self.name:
            frappe.throw("Раздел не может быть родителем сам себе")

    def before_save(self):
        # duration_days = end - start + 1
        if self.start_date and self.end_date:
            start = getdate(self.start_date)
            end = getdate(self.end_date)
            self.duration_days = max(0, (end - start).days + 1)
        else:
            self.duration_days = 0

        # Авто-смена статуса по прогрессу
        progress = flt(self.progress)
        if progress >= 100 and self.status not in ("Выполнена", "Отменена"):
            self.status = "Выполнена"
        elif 0 < progress < 100 and self.status == "Запланирована":
            self.status = "В работе"
        elif progress == 0 and self.status == "В работе":
            self.status = "Запланирована"
