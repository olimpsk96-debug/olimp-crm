from __future__ import annotations

import unittest
from datetime import date, timedelta

import frappe
from frappe.exceptions import ValidationError
from frappe.tests.utils import FrappeTestCase


def make_tender(**kwargs) -> frappe.Document:
    """Фабрика тендеров с дефолтными валидными значениями."""
    defaults = {
        "doctype": "Tender",
        "title": "Тест: АКЗ резервуаров",
        "status": "Новый",
        "work_type": "АКЗ",
        "region": "Свердловская обл.",
        "tender_law": "44-ФЗ",
        "nmck": 5_000_000,
        "deadline_date": str(date.today() + timedelta(days=14)),
    }
    defaults.update(kwargs)
    doc = frappe.get_doc(defaults)
    # Обходим проверку переходов workflow в тестах — тестируем только бизнес-логику
    doc.flags.ignore_workflow_permissions = True
    return doc


class TestTender(FrappeTestCase):

    # ── Создание ────────────────────────────────────────────────────

    def test_creation_minimal(self):
        """Тендер создаётся с минимальными обязательными полями."""
        doc = make_tender()
        doc.insert(ignore_permissions=True)
        self.assertTrue(doc.name.startswith("TND-"))
        frappe.delete_doc("Tender", doc.name, ignore_permissions=True)

    def test_naming_format(self):
        """Автонейминг содержит год и порядковый номер."""
        doc = make_tender(title="Тест naming")
        doc.insert(ignore_permissions=True)
        # Формат: TND-2026-0001
        parts = doc.name.split("-")
        self.assertEqual(parts[0], "TND")
        self.assertEqual(len(parts[1]), 4)   # год
        self.assertTrue(parts[2].isdigit())  # порядковый номер
        frappe.delete_doc("Tender", doc.name, ignore_permissions=True)

    # ── Расчёт маржи ────────────────────────────────────────────────

    def test_margin_calculated_on_save(self):
        """margin_pct рассчитывается автоматически из nmck и our_price."""
        doc = make_tender(nmck=10_000_000, our_price=8_500_000)
        doc.insert(ignore_permissions=True)
        self.assertAlmostEqual(doc.margin_pct, 15.0, places=1)
        frappe.delete_doc("Tender", doc.name, ignore_permissions=True)

    def test_margin_cleared_without_price(self):
        """margin_pct сбрасывается если our_price не указан."""
        doc = make_tender(nmck=5_000_000)
        doc.insert(ignore_permissions=True)
        self.assertIsNone(doc.margin_pct)
        frappe.delete_doc("Tender", doc.name, ignore_permissions=True)

    # ── Валидация цены ──────────────────────────────────────────────

    def test_price_exceeds_nmck_raises(self):
        """Наша цена выше НМЦК → ValidationError."""
        doc = make_tender(nmck=5_000_000, our_price=6_000_000)
        with self.assertRaises(ValidationError):
            doc.insert(ignore_permissions=True)

    def test_price_equals_nmck_allowed(self):
        """Наша цена равна НМЦК → допустимо (нулевая маржа)."""
        doc = make_tender(nmck=5_000_000, our_price=5_000_000)
        doc.insert(ignore_permissions=True)
        self.assertAlmostEqual(doc.margin_pct, 0.0, places=1)
        frappe.delete_doc("Tender", doc.name, ignore_permissions=True)

    # ── Валидация при победе ─────────────────────────────────────────

    def test_win_without_amount_raises(self):
        """Статус «Выиграли» без суммы контракта → ValidationError."""
        doc = make_tender(status="Выиграли")
        with self.assertRaises(ValidationError):
            doc.validate()

    def test_win_with_amount_ok(self):
        """Статус «Выиграли» с суммой контракта → validate() проходит без ошибок."""
        doc = make_tender(status="Выиграли", win_amount=4_800_000)
        doc.validate()  # Не должно бросать исключение

    # ── Валидация даты подачи ────────────────────────────────────────

    def test_submitted_without_date_raises(self):
        """Статус «Заявка подана» без даты подачи → ValidationError."""
        doc = make_tender(status="Заявка подана")
        with self.assertRaises(ValidationError):
            doc.validate()

    def test_submitted_with_date_ok(self):
        """Статус «Заявка подана» с датой подачи → validate() проходит."""
        doc = make_tender(
            status="Заявка подана",
            submission_date=str(date.today()),
        )
        doc.validate()  # Не должно бросать исключение

    # ── Синхронизация status ↔ result ────────────────────────────────

    def test_result_win_syncs_status(self):
        """Установка result=«Выиграли» в validate() меняет status."""
        doc = make_tender(win_amount=4_000_000)
        doc.result = "Выиграли"
        doc.validate()
        self.assertEqual(doc.status, "Выиграли")

    def test_result_lose_syncs_status(self):
        """Установка result=«Проиграли» в validate() меняет status."""
        doc = make_tender()
        doc.result = "Проиграли"
        doc.validate()
        self.assertEqual(doc.status, "Проиграли")

    # ── Просроченный дедлайн (предупреждение, не ошибка) ─────────────

    def test_past_deadline_active_status_no_exception(self):
        """Просроченный дедлайн для активного тендера — предупреждение, не исключение."""
        past = str(date.today() - timedelta(days=5))
        doc = make_tender(deadline_date=past, status="Новый")
        # Не должно бросать исключение, только msgprint
        doc.insert(ignore_permissions=True)
        frappe.delete_doc("Tender", doc.name, ignore_permissions=True)


if __name__ == "__main__":
    unittest.main()
