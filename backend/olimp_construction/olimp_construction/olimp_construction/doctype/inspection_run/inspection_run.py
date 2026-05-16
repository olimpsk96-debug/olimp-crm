import json

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class InspectionRun(Document):
    def before_save(self):
        """Считаем score_pct и critical_fails из answers_json."""
        try:
            answers = json.loads(self.answers_json or "[]")
            template = frappe.db.get_value("Inspection Template", self.template, "questions_json")
            questions = json.loads(template or "[]") if template else []
        except (json.JSONDecodeError, TypeError):
            return

        if not isinstance(answers, list) or not isinstance(questions, list):
            return

        q_by_id = {q.get("id"): q for q in questions if isinstance(q, dict)}

        max_score = 0
        actual_score = 0
        critical_fails = 0

        for ans in answers:
            if not isinstance(ans, dict):
                continue
            qid = ans.get("question_id")
            q = q_by_id.get(qid)
            if not q:
                continue
            weight = flt(q.get("weight") or 1)
            kind = q.get("kind") or "yesno"
            answer = ans.get("answer")

            if kind == "yesno":
                max_score += weight
                if answer == "yes" or answer is True:
                    actual_score += weight
                elif (answer == "no" or answer is False) and q.get("critical"):
                    critical_fails += 1
            elif kind == "score":
                # 1-5 баллов
                max_score += 5 * weight
                actual_score += flt(answer or 0) * weight
            elif kind == "photo":
                # Фото загружено = 1 (засчитываем как pass если есть)
                max_score += weight
                if answer:
                    actual_score += weight

        self.score_pct = round(actual_score / max_score * 100, 1) if max_score > 0 else 0
        self.critical_fails = critical_fails

        # Auto-status при завершении
        if self.finished_at and self.status == "В работе":
            self.status = "Завершён (Fail)" if critical_fails > 0 else "Завершён (Pass)"
