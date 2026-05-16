"""Batch API для RevoGrid spreadsheet-style редактора смет.

Идея: фронт хранит локальный state ячеек, при потере фокуса/Ctrl+S отправляет
дифф (added/modified/removed) — backend применяет в одной транзакции,
пересчитывает итоги.
"""
from __future__ import annotations

import frappe


@frappe.whitelist()
def get_items(estimate: str) -> dict:
    """Возвращает позиции сметы для grid (плоско, с порядком, total)."""
    frappe.has_permission("Estimate", "read", doc=estimate, throw=True)
    doc = frappe.get_doc("Estimate", estimate)

    rows: list[dict] = []
    for item in (doc.items or []):
        rows.append({
            "name": item.name,
            "idx": item.idx,
            "is_section": int(item.is_section or 0),
            "section_title": item.section_title or "",
            "item_code": item.item_code or "",
            "item_name": item.item_name or "",
            "unit": item.unit or "",
            "qty": float(item.qty or 0),
            "base_unit_price": float(item.base_unit_price or 0),
            "base_amount": float(item.base_amount or 0),
            "our_unit_price": float(item.our_unit_price or 0),
            "our_amount": float(item.our_amount or 0),
            "deviation_pct": float(item.deviation_pct or 0),
            "work_type": item.work_type or "",
            "notes": item.notes or "",
        })

    return {
        "estimate": doc.name,
        "title": doc.title or doc.name,
        "rows": rows,
        "totals": {
            "base_total": float(doc.base_total or 0),
            "our_total": float(doc.our_total or 0),
            "margin_amount": float(doc.margin_amount or 0),
            "margin_pct": float(doc.margin_pct or 0),
        },
        "project": doc.project,
        "tender": getattr(doc, "tender", None),
    }


@frappe.whitelist()
def save_items_batch(estimate: str, rows: list | str) -> dict:
    """Принимает полный список rows (snapshot grid'а) и заменяет items сметы.

    Стратегия: удаляем все child rows + insert заново. Это проще и надёжнее
    чем дифф (потому что Estimate Item имеет много connected полей).
    Затем сохраняем — родитель пересчитает базовый/наш total/маржу.
    """
    frappe.has_permission("Estimate", "write", doc=estimate, throw=True)

    if isinstance(rows, str):
        import json as _json
        rows = _json.loads(rows)
    if not isinstance(rows, list):
        frappe.throw("rows должен быть списком")

    doc = frappe.get_doc("Estimate", estimate)

    # Очищаем child table и вставляем новые
    doc.items = []
    for i, r in enumerate(rows, start=1):
        if not isinstance(r, dict):
            continue
        # Пропускаем пустые строки (без названия и кода)
        if not (r.get("item_name") or r.get("section_title") or r.get("item_code")):
            continue

        qty = float(r.get("qty") or 0)
        base_unit_price = float(r.get("base_unit_price") or 0)
        our_unit_price = float(r.get("our_unit_price") or 0)

        doc.append("items", {
            "idx": i,
            "is_section": int(r.get("is_section") or 0),
            "section_title": (r.get("section_title") or "")[:500],
            "item_code": (r.get("item_code") or "")[:140],
            "item_name": (r.get("item_name") or "")[:500],
            "unit": (r.get("unit") or "")[:30],
            "qty": qty,
            "base_unit_price": base_unit_price,
            "base_amount": qty * base_unit_price,
            "our_unit_price": our_unit_price,
            "our_amount": qty * our_unit_price,
            "work_type": (r.get("work_type") or "")[:140],
            "notes": (r.get("notes") or "")[:1000],
        })

    doc.save(ignore_permissions=False)
    frappe.db.commit()

    # Вернём пересчитанные totals
    fresh = frappe.get_doc("Estimate", estimate)
    return {
        "ok": True,
        "items_count": len(fresh.items or []),
        "totals": {
            "base_total": float(fresh.base_total or 0),
            "our_total": float(fresh.our_total or 0),
            "margin_amount": float(fresh.margin_amount or 0),
            "margin_pct": float(fresh.margin_pct or 0),
        },
    }


@frappe.whitelist()
def bulk_apply_markup(estimate: str, markup_pct: float = 15) -> dict:
    """Массово применяет наценку % к base_unit_price → our_unit_price."""
    frappe.has_permission("Estimate", "write", doc=estimate, throw=True)
    if float(markup_pct) < -50 or float(markup_pct) > 500:
        frappe.throw("Наценка должна быть в диапазоне -50%..+500%")

    doc = frappe.get_doc("Estimate", estimate)
    for it in (doc.items or []):
        base = float(it.base_unit_price or 0)
        if base > 0:
            it.our_unit_price = round(base * (1 + float(markup_pct) / 100), 2)
            it.our_amount = it.our_unit_price * float(it.qty or 0)

    doc.save(ignore_permissions=False)
    frappe.db.commit()

    return {
        "ok": True,
        "markup_pct": float(markup_pct),
        "items_updated": len(doc.items or []),
        "totals": {
            "base_total": float(doc.base_total or 0),
            "our_total": float(doc.our_total or 0),
            "margin_amount": float(doc.margin_amount or 0),
            "margin_pct": float(doc.margin_pct or 0),
        },
    }


@frappe.whitelist()
def create_proposal_from_estimate(estimate: str, title: str = "",
                                   template: str = "") -> dict:
    """Создаёт Construction Proposal на базе сметы с авто-вставкой EstimateTable.

    Procore Proposal Builder pattern — переключатель «Расчёт → Документ».
    """
    frappe.has_permission("Estimate", "read", doc=estimate, throw=True)
    frappe.has_permission("Construction Proposal", "create", throw=True)

    est = frappe.get_doc("Estimate", estimate)

    # Подготовим базовый TipTap content с таблицей позиций
    sections: list[dict] = []
    current_section: dict | None = None
    for item in (est.items or []):
        if int(item.is_section or 0):
            current_section = {
                "title": item.section_title or "Раздел",
                "rows": [],
            }
            sections.append(current_section)
        else:
            row = {
                "item_name": item.item_name or "",
                "unit": item.unit or "",
                "qty": float(item.qty or 0),
                "price": float(item.our_unit_price or 0),
                "amount": float(item.our_amount or 0),
            }
            if current_section:
                current_section["rows"].append(row)
            else:
                if not sections:
                    sections.append({"title": "Состав работ", "rows": []})
                sections[0]["rows"].append(row)

    # Соберём TipTap JSON
    content_nodes: list = [
        {"type": "heading", "attrs": {"level": 1}, "content": [
            {"type": "text", "text": "Коммерческое предложение"},
        ]},
        {"type": "paragraph", "content": [
            {"type": "text", "text": "Уважаемый "},
            {"type": "mergeTag", "attrs": {"path": "customer.name"}},
            {"type": "text", "text": ", готовы выполнить работы по объекту "},
            {"type": "mergeTag", "attrs": {"path": "project.title"}},
            {"type": "text", "text": "."},
        ]},
    ]

    # Для каждой секции — заголовок и таблица
    for section in sections:
        if not section["rows"]:
            continue
        content_nodes.append({
            "type": "heading", "attrs": {"level": 2},
            "content": [{"type": "text", "text": section["title"]}],
        })

        # Таблица
        header_row = {
            "type": "tableRow", "content": [
                {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Работа"}]}]},
                {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ед."}]}]},
                {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Кол-во"}]}]},
                {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Цена ₽"}]}]},
                {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Сумма ₽"}]}]},
            ],
        }
        data_rows = []
        for r in section["rows"]:
            data_rows.append({
                "type": "tableRow", "content": [
                    {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": r["item_name"]}]}]},
                    {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": r["unit"]}]}]},
                    {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"{r['qty']:.2f}".rstrip('0').rstrip('.')}]}]},
                    {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"{r['price']:,.0f}".replace(',', ' ')}]}]},
                    {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"{r['amount']:,.0f}".replace(',', ' ')}]}]},
                ],
            })
        content_nodes.append({"type": "table", "content": [header_row] + data_rows})

    # Итог
    content_nodes.append({
        "type": "paragraph", "content": [
            {"type": "text", "marks": [{"type": "bold"}], "text": "ИТОГО: "},
            {"type": "mergeTag", "attrs": {"path": "proposal.total_amount"}},
            {"type": "text", "text": " ₽"},
        ],
    })

    # График оплаты по умолчанию
    content_nodes.append({"type": "heading", "attrs": {"level": 2},
                         "content": [{"type": "text", "text": "Условия оплаты"}]})
    content_nodes.append({
        "type": "paymentSchedule", "attrs": {
            "rows": [
                {"stage": "Аванс при подписании", "percent": 30, "days_after": 0},
                {"stage": "Этап 1 — материалы", "percent": 40, "days_after": 14},
                {"stage": "Этап 2 — основные работы", "percent": 25, "days_after": 45},
                {"stage": "Финальный платёж", "percent": 5, "days_after": 90},
            ],
            "currency": "RUB",
        },
    })

    content = {"type": "doc", "content": content_nodes}

    # Создаём КП
    import json as _json
    from olimp_construction.api.proposals import save_proposal
    result = save_proposal(
        title=title or f"КП по смете {est.name}",
        customer=getattr(est, "customer", "") or "",
        project=est.project or "",
        estimate_link=est.name,
        template_used=template or "",
        total_amount=float(est.our_total or 0),
        content_json=_json.dumps(content, ensure_ascii=False),
    )
    return {"ok": True, "proposal_name": result["name"], "sections": len(sections),
            "total": float(est.our_total or 0)}
