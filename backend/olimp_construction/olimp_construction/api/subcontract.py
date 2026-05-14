"""API для модуля субподрядных тендеров (Subcontract Bid Request + Proposal).

Эндпоинты:
- get_list / get_stats / get_detail — список и сводка по тендерам
- save_bid_request — создание / обновление тендера
- create_from_estimate — pre-fill позиций из Estimate по фильтру work_type
- save_proposal — добавить/обновить КП от подрядчика (+ Telegram директору)
- set_winner — присудить тендер: status, awarded_to, остальные предложения → Отклонено
- compare_proposals — side-by-side таблица: строки Bid Item × колонки Proposals
"""
from __future__ import annotations

import json

import frappe
from frappe.utils import flt, getdate, today

from olimp_construction.telegram_utils import send_message


# ── Список / KPI / детали ────────────────────────────────────────────────────

@frappe.whitelist()
def get_list(
    project: str | None = None,
    status: str | None = None,
    work_type: str | None = None,
) -> list[dict]:
    """Список Subcontract Bid Request с фильтрами.

    Сортировка: ближайший дедлайн сверху (NULL в конец), потом по дате создания.
    """
    frappe.has_permission("Subcontract Bid Request", throw=True)

    filters: dict = {}
    if project:
        filters["project"] = project
    if status:
        filters["status"] = status
    if work_type:
        filters["work_type"] = work_type

    rows = frappe.db.sql(
        """
        SELECT
            name, title, project, estimate, status, work_type,
            sent_date, deadline_date, work_start_date, work_end_date,
            total_target_amount, best_proposal_amount,
            savings_amount, savings_pct,
            awarded_to, proposals_count, created_by_full_name,
            creation
        FROM `tabSubcontract Bid Request`
        WHERE (%(project)s IS NULL OR project = %(project)s)
          AND (%(status)s IS NULL OR status = %(status)s)
          AND (%(work_type)s IS NULL OR work_type = %(work_type)s)
        ORDER BY
            CASE WHEN deadline_date IS NULL THEN 1 ELSE 0 END ASC,
            deadline_date ASC,
            creation DESC
        LIMIT 500
        """,
        {"project": project, "status": status, "work_type": work_type},
        as_dict=True,
    )
    return rows


@frappe.whitelist()
def get_stats(project: str | None = None) -> dict:
    """KPI по тендерам: total / active / awarded / cancelled / savings / proposals."""
    frappe.has_permission("Subcontract Bid Request", throw=True)

    project_clause = ""
    params: dict = {}
    if project:
        project_clause = "WHERE project = %(project)s"
        params["project"] = project

    row = frappe.db.sql(
        f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status IN ('Отправлено','Приём предложений','Сравнение') THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'Присуждён' THEN 1 ELSE 0 END) AS awarded,
            SUM(CASE WHEN status = 'Отменён' THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN status = 'Присуждён' THEN savings_amount ELSE 0 END) AS total_savings,
            SUM(CASE WHEN status IN ('Отправлено','Приём предложений','Сравнение','Присуждён')
                     THEN total_target_amount ELSE 0 END) AS total_target_amount,
            SUM(proposals_count) AS proposals_total
        FROM `tabSubcontract Bid Request`
        {project_clause}
        """,
        params,
        as_dict=True,
    )[0]

    return {
        "total": int(row.get("total") or 0),
        "active": int(row.get("active") or 0),
        "awarded": int(row.get("awarded") or 0),
        "cancelled": int(row.get("cancelled") or 0),
        "total_savings": flt(row.get("total_savings") or 0),
        "total_target_amount": flt(row.get("total_target_amount") or 0),
        "proposals_total": int(row.get("proposals_total") or 0),
    }


@frappe.whitelist()
def get_detail(name: str) -> dict:
    """Детальная карточка тендера + список предложений по нему."""
    frappe.has_permission("Subcontract Bid Request", "read", throw=True)
    doc = frappe.get_doc("Subcontract Bid Request", name).as_dict()

    proposals = frappe.db.sql(
        """
        SELECT
            name, supplier, supplier_name_snapshot, status,
            received_date, valid_until,
            total_amount, vs_target_pct,
            delivery_terms, payment_terms, contact_phone,
            attachment_file, notes
        FROM `tabSubcontract Proposal`
        WHERE bid_request = %(br)s
        ORDER BY total_amount ASC
        """,
        {"br": name},
        as_dict=True,
    )
    doc["proposals"] = proposals
    return doc


# ── Создание / редактирование ────────────────────────────────────────────────

@frappe.whitelist()
def save_bid_request(data: dict | str) -> dict:
    """Создать/обновить тендер. `items` — массив позиций (см. Subcontract Bid Item)."""
    frappe.has_permission("Subcontract Bid Request", "create", throw=True)
    if isinstance(data, str):
        data = json.loads(data)

    items = data.pop("items", []) or []
    name = data.get("name")

    if name and frappe.db.exists("Subcontract Bid Request", name):
        frappe.has_permission("Subcontract Bid Request", "write", doc=name, throw=True)
        doc = frappe.get_doc("Subcontract Bid Request", name)
        doc.update(data)
        doc.set("items", items)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        return {"name": doc.name, "updated": True}

    doc = frappe.get_doc({"doctype": "Subcontract Bid Request", **data, "items": items})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "created": True}


@frappe.whitelist()
def create_from_estimate(
    estimate: str,
    work_type: str | None = None,
    item_codes: list[str] | str | None = None,
) -> dict:
    """Pre-fill: возвращает позиции из Estimate, готовые для нового Subcontract Bid Request.

    Не сохраняет — отдаёт фронту данные, он показывает в drawer и пользователь редактирует.
    Фильтр: либо по work_type (если у Estimate Item есть такое поле), либо по списку кодов.
    """
    frappe.has_permission("Estimate", "read", doc=estimate, throw=True)

    if isinstance(item_codes, str):
        try:
            item_codes = json.loads(item_codes)
        except json.JSONDecodeError:
            item_codes = [c.strip() for c in item_codes.split(",") if c.strip()]

    est = frappe.get_doc("Estimate", estimate)
    items_out: list[dict] = []
    for it in (est.get("items") or []):
        code = getattr(it, "item_code", None) or it.get("item_code") if isinstance(it, dict) else getattr(it, "item_code", None)
        if item_codes and code not in item_codes:
            continue
        items_out.append({
            "item_code": getattr(it, "item_code", ""),
            "item_name": getattr(it, "item_name", "") or getattr(it, "description", ""),
            "unit": getattr(it, "unit", "") or "",
            "qty": flt(getattr(it, "qty", 0)),
            "our_unit_price": flt(getattr(it, "our_unit_price", 0) or getattr(it, "unit_price", 0)),
            "work_type": work_type or "",
            "source_estimate_item": getattr(it, "name", ""),
        })

    return {
        "project": getattr(est, "project", None),
        "estimate": estimate,
        "items": items_out,
        "items_count": len(items_out),
        "work_type": work_type,
    }


# ── Предложения от подрядчиков ───────────────────────────────────────────────

@frappe.whitelist()
def save_proposal(data: dict | str, notify_director: int | bool = 1) -> dict:
    """Сохранить КП от субподрядчика. По умолчанию шлёт Telegram директору."""
    frappe.has_permission("Subcontract Proposal", "create", throw=True)
    if isinstance(data, str):
        data = json.loads(data)

    items = data.pop("items", []) or []
    name = data.get("name")

    if name and frappe.db.exists("Subcontract Proposal", name):
        frappe.has_permission("Subcontract Proposal", "write", doc=name, throw=True)
        doc = frappe.get_doc("Subcontract Proposal", name)
        doc.update(data)
        doc.set("items", items)
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        is_new = False
    else:
        data.setdefault("received_date", today())
        doc = frappe.get_doc({"doctype": "Subcontract Proposal", **data, "items": items})
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        is_new = True

    # При создании нового КП — Telegram директору
    if is_new and int(notify_director or 0):
        _notify_director_new_proposal(doc)

    return {"name": doc.name, "created": is_new, "total_amount": flt(doc.total_amount), "vs_target_pct": flt(doc.vs_target_pct)}


def _notify_director_new_proposal(proposal) -> None:
    """Telegram директору о новом КП. Не падаем если Telegram недоступен."""
    try:
        br = frappe.db.get_value(
            "Subcontract Bid Request",
            proposal.bid_request,
            ["title", "total_target_amount"],
            as_dict=True,
        ) or {}
        supplier = proposal.supplier_name_snapshot or proposal.supplier or "?"
        total_mln = (flt(proposal.total_amount) / 1_000_000)
        target_mln = (flt(br.get("total_target_amount")) / 1_000_000)
        vs = flt(proposal.vs_target_pct)
        arrow = "↓" if vs < 100 else ("↑" if vs > 100 else "=")
        msg = (
            f"💼 <b>Новое КП на субподряд</b>\n\n"
            f"<b>Тендер:</b> {br.get('title', proposal.bid_request)}\n"
            f"<b>Подрядчик:</b> {supplier}\n"
            f"<b>Цена:</b> {total_mln:.2f} млн ₽ "
            f"({vs:.0f}% {arrow} к нашей оценке {target_mln:.2f} млн)\n\n"
            f"/proposal_{proposal.name}"
        )
        send_message(msg)
    except Exception as exc:  # noqa: BLE001
        frappe.logger().warning(f"Telegram уведомление о новом КП не отправлено: {exc}")


# ── Side-by-side сравнение ───────────────────────────────────────────────────

@frappe.whitelist()
def compare_proposals(bid_request: str) -> dict:
    """Side-by-side таблица: строки Bid Item × колонки Proposals.

    Возвращает структуру, удобную для рендера в React:
      {
        bid_request: {...},
        proposals: [{name, supplier, total, vs_target_pct, status}, ...],
        rows: [
            {
              bid_item: {name, item_name, unit, qty, our_unit_price, our_amount},
              prices: {<proposal_name>: {unit_price, amount, notes}, ...},
              cheapest_proposal: "SP-2026-00002",
            },
            ...
        ]
      }
    """
    frappe.has_permission("Subcontract Bid Request", "read", doc=bid_request, throw=True)

    br = frappe.get_doc("Subcontract Bid Request", bid_request)
    br_items = list(br.get("items") or [])

    proposals = frappe.get_all(
        "Subcontract Proposal",
        filters={"bid_request": bid_request},
        fields=[
            "name", "supplier", "supplier_name_snapshot", "status",
            "total_amount", "vs_target_pct", "received_date",
        ],
        order_by="total_amount asc",
    )

    # Подгружаем позиции всех proposals одним запросом
    proposal_items: list[dict] = []
    if proposals:
        proposal_names = [p["name"] for p in proposals]
        proposal_items = frappe.db.sql(
            """
            SELECT parent, linked_bid_item, item_name, unit, qty,
                   supplier_unit_price, supplier_amount, supplier_notes
            FROM `tabSubcontract Proposal Item`
            WHERE parent IN %(names)s
            """,
            {"names": tuple(proposal_names)},
            as_dict=True,
        )

    # Индекс: { (proposal_name, linked_bid_item) -> item_dict }
    pidx: dict = {}
    for pi in proposal_items:
        pidx[(pi["parent"], pi["linked_bid_item"])] = pi

    rows: list[dict] = []
    for bi in br_items:
        bi_name = bi.name
        prices: dict = {}
        cheapest = None
        cheapest_amt = float("inf")
        for p in proposals:
            pi = pidx.get((p["name"], bi_name))
            if pi:
                amt = flt(pi.get("supplier_amount"))
                prices[p["name"]] = {
                    "unit_price": flt(pi.get("supplier_unit_price")),
                    "amount": amt,
                    "notes": pi.get("supplier_notes") or "",
                }
                if amt > 0 and amt < cheapest_amt:
                    cheapest_amt = amt
                    cheapest = p["name"]
            else:
                prices[p["name"]] = None
        rows.append({
            "bid_item": {
                "name": bi_name,
                "item_code": bi.item_code,
                "item_name": bi.item_name,
                "unit": bi.unit,
                "qty": flt(bi.qty),
                "our_unit_price": flt(bi.our_unit_price),
                "our_amount": flt(bi.our_amount),
                "work_type": bi.work_type,
            },
            "prices": prices,
            "cheapest_proposal": cheapest,
        })

    return {
        "bid_request": {
            "name": br.name,
            "title": br.title,
            "project": br.project,
            "status": br.status,
            "total_target_amount": flt(br.total_target_amount),
            "best_proposal_amount": flt(br.best_proposal_amount),
            "savings_amount": flt(br.savings_amount),
            "savings_pct": flt(br.savings_pct),
            "awarded_to": br.awarded_to,
        },
        "proposals": proposals,
        "rows": rows,
    }


# ── Присуждение тендера ──────────────────────────────────────────────────────

@frappe.whitelist()
def set_winner(bid_request: str, proposal: str) -> dict:
    """Присудить тендер: победитель + статусы остальных предложений.

    - Bid Request: status="Присуждён", awarded_to=supplier
    - Winning Proposal: status="Выбрано"
    - Остальные active proposals: status="Отклонено"
    """
    frappe.has_permission("Subcontract Bid Request", "write", doc=bid_request, throw=True)

    if not frappe.db.exists("Subcontract Proposal", proposal):
        frappe.throw(f"Предложение {proposal} не найдено")
    win = frappe.get_doc("Subcontract Proposal", proposal)
    if win.bid_request != bid_request:
        frappe.throw("Предложение не относится к этому тендеру")

    # Остальные предложения → Отклонено
    others = frappe.get_all(
        "Subcontract Proposal",
        filters={
            "bid_request": bid_request,
            "name": ["!=", proposal],
            "status": ["in", ("Получено", "На рассмотрении")],
        },
        pluck="name",
    )
    for nm in others:
        p = frappe.get_doc("Subcontract Proposal", nm)
        p.status = "Отклонено"
        p.save(ignore_permissions=True)

    # Победитель
    win.status = "Выбрано"
    win.save(ignore_permissions=True)

    # Тендер
    br = frappe.get_doc("Subcontract Bid Request", bid_request)
    br.status = "Присуждён"
    br.awarded_to = win.supplier
    br.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "ok": True,
        "winner": proposal,
        "rejected": others,
        "savings_amount": flt(br.savings_amount),
        "savings_pct": flt(br.savings_pct),
    }
