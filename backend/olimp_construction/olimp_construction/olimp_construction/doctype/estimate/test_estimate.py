from __future__ import annotations

import unittest

import frappe
from frappe.tests.utils import FrappeTestCase


def make_item(name: str, qty: float, base_price: float, our_price: float | None = None, is_section: int = 0) -> dict:
    return {
        "item_name": name,
        "is_section": is_section,
        "qty": qty,
        "base_unit_price": base_price,
        "our_unit_price": our_price if our_price is not None else base_price,
        "unit": "м²",
    }


def make_estimate(**kwargs) -> frappe.Document:
    defaults = {
        "doctype": "Estimate",
        "title": "Тест: АКЗ Marins Park",
        "status": "Базовая",
        "overhead_pct": 0,
        "profit_pct": 0,
        "items": [
            make_item("Очистка поверхности", 100, 250, 280),
            make_item("Грунтование", 100, 180, 200),
            make_item("Покраска 2 слоя", 100, 420, 480),
        ],
    }
    defaults.update(kwargs)
    doc = frappe.get_doc(defaults)
    return doc


class TestEstimate(FrappeTestCase):

    # ── Создание ────────────────────────────────────────────────────

    def test_creation_minimal(self):
        """Смета создаётся с минимальными полями."""
        doc = make_estimate()
        doc.insert(ignore_permissions=True)
        self.assertTrue(doc.name.startswith("EST-"))
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    def test_naming_format(self):
        """Автонейминг содержит год и порядковый номер."""
        doc = make_estimate(title="Тест нейминг")
        doc.insert(ignore_permissions=True)
        import re
        self.assertRegex(doc.name, r"^EST-\d{4}-\d{5}$")  # EST-2026-00001
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    # ── Расчёт позиций ──────────────────────────────────────────────

    def test_item_base_amount_calculated(self):
        """base_amount = qty × base_unit_price."""
        doc = make_estimate(
            items=[make_item("Очистка", 50, 300)]
        )
        doc.insert(ignore_permissions=True)
        item = doc.items[0]
        self.assertAlmostEqual(item.base_amount, 50 * 300, places=2)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    def test_item_our_amount_calculated(self):
        """our_amount = qty × our_unit_price."""
        doc = make_estimate(
            items=[make_item("Покраска", 80, 400, 460)]
        )
        doc.insert(ignore_permissions=True)
        item = doc.items[0]
        self.assertAlmostEqual(item.our_amount, 80 * 460, places=2)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    def test_item_deviation_positive(self):
        """Положительное отклонение когда our_price > base_price."""
        doc = make_estimate(
            items=[make_item("Грунт", 100, 200, 240)]
        )
        doc.insert(ignore_permissions=True)
        item = doc.items[0]
        expected = (240 - 200) / 200 * 100  # 20%
        self.assertAlmostEqual(item.deviation_pct, expected, places=1)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    def test_item_deviation_negative(self):
        """Отрицательное отклонение когда our_price < base_price."""
        doc = make_estimate(
            items=[make_item("Работы", 100, 500, 400)]
        )
        doc.insert(ignore_permissions=True)
        item = doc.items[0]
        self.assertLess(item.deviation_pct, 0)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    def test_section_row_skipped_in_totals(self):
        """Строки-разделы не попадают в итоги."""
        doc = make_estimate(
            items=[
                make_item("Раздел 1. АКЗ", 0, 0, is_section=1),
                make_item("Очистка", 10, 100, 120),
            ]
        )
        doc.insert(ignore_permissions=True)
        self.assertAlmostEqual(doc.our_total, 10 * 120, places=2)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    # ── Итоги сметы ────────────────────────────────────────────────

    def test_base_total_sum(self):
        """base_total = сумма base_amount по всем позициям."""
        doc = make_estimate(
            items=[
                make_item("Работа 1", 100, 200),
                make_item("Работа 2", 50, 400),
            ]
        )
        doc.insert(ignore_permissions=True)
        expected = 100 * 200 + 50 * 400  # 40 000
        self.assertAlmostEqual(doc.base_total, expected, places=2)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    def test_our_total_sum(self):
        """our_total = сумма our_amount по всем позициям."""
        doc = make_estimate(
            items=[
                make_item("Р1", 100, 200, 220),
                make_item("Р2", 50, 400, 450),
            ]
        )
        doc.insert(ignore_permissions=True)
        expected = 100 * 220 + 50 * 450  # 44 500
        self.assertAlmostEqual(doc.our_total, expected, places=2)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    # ── Накладные и прибыль ────────────────────────────────────────

    def test_overhead_adds_to_totals(self):
        """Накладные % увеличивают base_total и our_total."""
        doc = make_estimate(
            overhead_pct=10,
            items=[make_item("Работы", 100, 1000, 1000)]
        )
        doc.insert(ignore_permissions=True)
        self.assertAlmostEqual(doc.base_total, 100 * 1000 * 1.10, places=2)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    def test_profit_adds_to_totals(self):
        """Сметная прибыль % увеличивает итог."""
        doc = make_estimate(
            profit_pct=5,
            items=[make_item("Работы", 100, 1000, 1000)]
        )
        doc.insert(ignore_permissions=True)
        self.assertAlmostEqual(doc.base_total, 100 * 1000 * 1.05, places=2)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    def test_overhead_and_profit_combined(self):
        """Накладные + прибыль вместе применяются к итогу."""
        doc = make_estimate(
            overhead_pct=10, profit_pct=5,
            items=[make_item("Р", 100, 1000, 1000)]
        )
        doc.insert(ignore_permissions=True)
        self.assertAlmostEqual(doc.base_total, 100 * 1000 * 1.15, places=2)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    # ── Маржа ──────────────────────────────────────────────────────

    def test_margin_pct_positive(self):
        """Маржа > 0 когда our > base."""
        doc = make_estimate(
            items=[make_item("Р", 100, 1000, 1200)]
        )
        doc.insert(ignore_permissions=True)
        self.assertGreater(doc.margin_pct, 0)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    def test_margin_amount_equals_diff(self):
        """margin_amount = our_total - base_total."""
        doc = make_estimate(
            items=[make_item("Р", 1, 1000, 1300)]
        )
        doc.insert(ignore_permissions=True)
        self.assertAlmostEqual(doc.margin_amount, doc.our_total - doc.base_total, places=2)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    def test_margin_zero_when_equal_prices(self):
        """Маржа = 0 когда наша цена = норм."""
        doc = make_estimate(
            items=[make_item("Р", 100, 500, 500)]
        )
        doc.insert(ignore_permissions=True)
        self.assertAlmostEqual(doc.margin_pct, 0, places=2)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)

    # ── Пустая смета ───────────────────────────────────────────────

    def test_empty_items_zero_totals(self):
        """Смета без позиций: все итоги = 0."""
        doc = make_estimate(items=[])
        doc.insert(ignore_permissions=True)
        self.assertEqual(doc.base_total, 0)
        self.assertEqual(doc.our_total, 0)
        self.assertEqual(doc.margin_pct, 0)
        frappe.delete_doc("Estimate", doc.name, ignore_permissions=True)
