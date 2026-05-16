from __future__ import annotations

import frappe
from frappe.model.document import Document


class ConstructionProjectUpdate(Document):
    def before_save(self):
        # Заголовок: "PR-2026-0001 · 12.05.2026"
        if self.project and self.week_start:
            self.title = f"{self.project} · {frappe.utils.formatdate(self.week_start, 'dd.MM.yyyy')}"

        # Если CPI/SPI не указан вручную — попытаемся подтянуть из последнего EVM Snapshot
        if self.project and not self.cpi_snapshot:
            snap = frappe.db.get_value(
                "EVM Snapshot",
                {"project": self.project},
                ["cpi", "spi"],
                order_by="snapshot_date DESC",
            )
            if snap:
                self.cpi_snapshot = snap[0]
                self.spi_snapshot = snap[1]
