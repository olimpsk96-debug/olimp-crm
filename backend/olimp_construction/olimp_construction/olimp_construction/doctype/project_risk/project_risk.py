"""Project Risk — реестр рисков проекта с автоматическим расчётом контингенции.

risk_score        = P × I (от 1 до 25)
contingency_amount = impact_amount × probability / 5 (ожидаемая стоимость риска)

Цветовые зоны (для UI):
- Красная:  score ≥ 15
- Жёлтая:   8 ≤ score < 15
- Зелёная:  score < 8
"""
import frappe
from frappe.model.document import Document
from frappe.utils import flt


def _parse_level(s) -> int:
    """Извлекает число из строк вида '1 — Очень низкая' / '5 - Критическое' (any dash)."""
    if not s:
        return 0
    head = str(s).strip().split(None, 1)[0]
    try:
        return int(head)
    except ValueError:
        return 0


class ProjectRisk(Document):
    def validate(self):
        if flt(self.impact_amount) < 0:
            frappe.throw("Финансовый импакт не может быть отрицательным")

    def before_save(self):
        p = _parse_level(self.probability)
        i = _parse_level(self.impact)
        self.risk_score = p * i

        # Контингенция = ожидаемая стоимость риска (impact × probability / 5)
        if self.impact_amount and p:
            self.contingency_amount = flt(self.impact_amount) * p / 5.0
        else:
            self.contingency_amount = 0

        # Защита от опечатки: статус "Закрыт"/"Реализовался" без actual_outcome — варнинг
        if self.status in ("Закрыт", "Реализовался") and not (self.actual_outcome or "").strip():
            frappe.msgprint(
                "Заполните «Фактический исход» для закрытого риска",
                indicator="orange", alert=True,
            )
