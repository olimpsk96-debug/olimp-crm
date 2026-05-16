from __future__ import annotations
import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class Deal(Document):
    def before_save(self):
        # Обновляем last_activity_date при любом сохранении (смена статуса, заметки и т.д.)
        if self.has_value_changed("status") or self.is_new():
            self.last_activity_date = now_datetime()

        # first_response_at: при первой смене статуса с «Лид» на что-то другое
        if (self.has_value_changed("status")
            and self.status != "Лид"
            and not self.first_response_at):
            self.first_response_at = now_datetime()
            # Сбрасываем missed-флаг — менеджер ответил
            self.is_missed = 0
            self.missed_minutes = 0

        # Auto-assign round-robin при создании (если assigned_to не задан вручную)
        if self.is_new() and not self.assigned_to:
            try:
                from olimp_construction.api.lead_routing import pick_next_assignee
                self.assigned_to = pick_next_assignee()
                self.assigned_at = now_datetime()
            except Exception as e:
                frappe.logger().warning(f"Auto-assign failed: {e}")

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

        # Auto-scoring (rule-based)
        try:
            from olimp_construction.api.lead_scoring import calculate_score
            import json as _json
            result = calculate_score(self.as_dict())
            self.lead_score = result["score"]
            self.lead_grade = result["grade"]
            self.lead_score_breakdown = _json.dumps(result["breakdown"], ensure_ascii=False)[:1000]
        except Exception:
            pass  # не блокируем save если scoring упал
