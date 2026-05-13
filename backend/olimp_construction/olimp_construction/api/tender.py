from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import getdate


@frappe.whitelist()
def create_from_tenderguru(tender_data: dict) -> dict:
    """Создаёт Tender из данных TenderGuru. Вызывается из n8n.

    TenderGuru поля: ID, TenderName, Customer, Region, NMCK/Price,
    Deadline/EndDate, Platform (URL), Law/f.

    Возвращает {"created": name} если создан, {"skipped": name} если уже существует.
    """
    frappe.has_permission("Tender", "create", throw=True)

    # TenderGuru использует числовой ID как номер закупки
    purchase_number = str(
        tender_data.get("PurchaseNumber")
        or tender_data.get("RegNumber")
        or tender_data.get("ID")
        or tender_data.get("id")
        or ""
    )

    # Дедупликация по номеру закупки
    if purchase_number:
        existing = frappe.db.get_value("Tender", {"purchase_number": purchase_number}, "name")
        if existing:
            return {"skipped": existing, "reason": "already_exists"}

    # Маппинг закона (TenderGuru возвращает числовой код в поле Law или f)
    law_raw = str(
        tender_data.get("Law") or tender_data.get("f") or tender_data.get("FZ") or ""
    ).upper()
    if "44" in law_raw:
        tender_law = "44-ФЗ"
    elif "223" in law_raw:
        tender_law = "223-ФЗ"
    else:
        tender_law = "Коммерческий"

    # Название тендера
    title = (
        tender_data.get("TenderName")
        or tender_data.get("Name")
        or tender_data.get("Subject")
        or "Без названия"
    )

    work_type = _detect_work_type(str(title))

    # НМЦК: TenderGuru может передавать NMCK или Price
    nmck = _parse_money(
        tender_data.get("NMCK") or tender_data.get("Nmck") or tender_data.get("Price")
    )

    # Дедлайн: Deadline, EndDate или ApplicationDeadline
    deadline = _parse_date(
        tender_data.get("Deadline")
        or tender_data.get("EndDate")
        or tender_data.get("ApplicationDeadline")
        or tender_data.get("SubmissionDeadline")
    )

    # Ссылка на площадку
    platform_url = (
        tender_data.get("Href")
        or tender_data.get("URL")
        or tender_data.get("Link")
        or tender_data.get("Platform")
    )

    region = tender_data.get("Region") or tender_data.get("RegionName")

    # Заказчик
    customer_name = (
        tender_data.get("Customer")
        or tender_data.get("CustomerName")
        or tender_data.get("Organizer")
    )

    doc = frappe.get_doc({
        "doctype": "Tender",
        "title": title,
        "status": "Новый",
        "tender_law": tender_law,
        "purchase_number": purchase_number,
        "platform_url": platform_url,
        "region": region,
        "nmck": nmck,
        "deadline_date": deadline,
        "work_type": work_type,
    })

    # Если заказчик найден — привяжем (если запись Customer существует)
    if customer_name:
        existing_customer = frappe.db.get_value("Customer", {"customer_name": customer_name}, "name")
        if existing_customer:
            doc.customer = existing_customer

    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    frappe.logger().info(f"TenderGuru: создан {doc.name} — {doc.title}")
    return {"created": doc.name}


VALID_STATUSES = (
    "Новый", "Оценивается", "Готовится заявка",
    "Заявка подана", "Выиграли", "Проиграли", "Отклонён",
)

VALID_LAWS = ("44-ФЗ", "223-ФЗ", "Коммерческий")
VALID_WORK_TYPES = ("АКЗ", "Кровля", "Промальп", "Монолит", "Усиление")


@frappe.whitelist()
def create_tender(
    title: str,
    tender_law: str = "44-ФЗ",
    work_type: str | None = None,
    nmck: float | None = None,
    deadline_date: str | None = None,
    region: str | None = None,
    purchase_number: str | None = None,
    platform_url: str | None = None,
) -> dict:
    """Создаёт новый тендер вручную из UI."""
    frappe.has_permission("Tender", "create", throw=True)

    if not title or not title.strip():
        frappe.throw(_("Название тендера обязательно"))

    doc = frappe.get_doc({
        "doctype": "Tender",
        "title": title.strip(),
        "status": "Новый",
        "tender_law": tender_law if tender_law in VALID_LAWS else "44-ФЗ",
        "work_type": work_type if work_type in VALID_WORK_TYPES else None,
        "nmck": _parse_money(nmck),
        "deadline_date": _parse_date(deadline_date),
        "region": region,
        "purchase_number": purchase_number,
        "platform_url": platform_url,
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    frappe.logger().info(f"UI: создан тендер {doc.name} — {doc.title}")
    return {"created": doc.name}


@frappe.whitelist()
def set_status(name: str, status: str) -> dict:
    """Меняет статус тендера напрямую, минуя Workflow-переходы.

    Используется из UI-дропдауна — директор вправе поставить любой статус.
    """
    frappe.has_permission("Tender", "write", throw=True)

    if status not in VALID_STATUSES:
        frappe.throw(_(f"Недопустимый статус: {status}"))

    frappe.db.set_value("Tender", name, "status", status)
    frappe.db.commit()
    return {"ok": True, "name": name, "status": status}


def _detect_work_type(title: str) -> str:
    title_lower = title.lower()
    if any(w in title_lower for w in ["акз", "антикорр", "покрасок", "покраск", "грунт"]):
        return "АКЗ"
    if any(w in title_lower for w in ["кровл", "кровол", "гидроизол"]):
        return "Кровля"
    if any(w in title_lower for w in ["промальп", "высотн", "альпинист"]):
        return "Промальп"
    if any(w in title_lower for w in ["монолит", "бетон", "желез"]):
        return "Монолит"
    if any(w in title_lower for w in ["усилен", "реконструкц"]):
        return "Усиление"
    return None


def _parse_money(value) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).replace(" ", "").replace(",", "."))
    except (ValueError, TypeError):
        return None


def _parse_date(value) -> str | None:
    if not value:
        return None
    try:
        return str(getdate(str(value)))
    except Exception:
        return None


@frappe.whitelist()
def get_pipeline() -> list[dict]:
    """Возвращает все тендеры для pipeline-view."""
    frappe.has_permission("Tender", throw=True)

    return frappe.get_all(
        "Tender",
        fields=[
            "name", "title", "status", "customer",
            "tender_law", "work_type", "region",
            "nmck", "our_price", "margin_pct",
            "deadline_date", "deadline_time",
            "ai_match_score", "ai_recommendation",
            "result",
        ],
        order_by="deadline_date asc",
        limit=200,
    )
