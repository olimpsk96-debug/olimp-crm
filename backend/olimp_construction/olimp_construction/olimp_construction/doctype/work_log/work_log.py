from __future__ import annotations

from frappe.model.document import Document


class WorkLog(Document):
    """Общий журнал работ (КС-6 по 87-ПП РФ)."""

    def before_save(self) -> None:
        # Авто-сводка по записям
        entries = self.entries or []
        self.entries_count = len(entries)
        self.total_workers_days = sum(int(e.workers_count or 0) for e in entries)
        self.issues_count = sum(1 for e in entries if e.has_issues)
        self.hidden_works_count = sum(1 for e in entries if e.hidden_works)
