"""API для Construction Proposal (КП-конструктор).

Архитектура:
- TipTap JSON хранится в content_json (Long Text)
- Share-link через JWT (HS256, секрет в site_config)
- Публичный endpoint render_for_public с allow_guest=True
- Подпись клиента — base64 PNG из react-signature-canvas
- PDF/DOCX экспорт через WeasyPrint/docxtpl
"""
from __future__ import annotations

import base64
import json
import secrets
from datetime import timedelta

import frappe
from frappe.utils import add_days, get_request_session, nowdate, now_datetime


VALID_STATUSES = (
    "Черновик", "Готово к отправке", "Отправлено",
    "Просмотрено клиентом", "Согласовано", "Отклонено", "Истекло",
)


# ───────────────────────────── CRUD ─────────────────────────────────────────


@frappe.whitelist()
def list_proposals(status: str | None = None, customer: str | None = None,
                   project: str | None = None, days: int = 365,
                   limit: int = 100) -> list[dict]:
    frappe.has_permission("Construction Proposal", throw=True)

    filters: dict = {"modified": [">=", add_days(nowdate(), -int(days))]}
    if status:
        filters["status"] = status
    if customer:
        filters["customer"] = customer
    if project:
        filters["project"] = project

    rows = frappe.get_all(
        "Construction Proposal",
        filters=filters,
        fields=["name", "title", "customer", "project", "estimate_link",
                "status", "total_amount", "valid_until",
                "sent_at", "first_viewed_at", "view_count",
                "signed_at", "signed_by_name",
                "share_token", "share_token_expires",
                "owner", "creation", "modified"],
        order_by="modified DESC",
        limit_page_length=int(limit),
    )
    for r in rows:
        if r.get("customer"):
            r["customer_name"] = frappe.db.get_value("Customer", r["customer"], "customer_name") or r["customer"]
        if r.get("project"):
            r["project_title"] = frappe.db.get_value("Construction Project", r["project"], "title") or r["project"]
    return rows


@frappe.whitelist()
def get_proposal(name: str) -> dict:
    frappe.has_permission("Construction Proposal", "read", doc=name, throw=True)
    doc = frappe.get_doc("Construction Proposal", name)
    out = doc.as_dict()
    # Парсим content_json если есть
    if doc.content_json:
        try:
            out["content"] = json.loads(doc.content_json)
        except (json.JSONDecodeError, TypeError):
            out["content"] = None
    return out


@frappe.whitelist()
def save_proposal(name: str | None = None,
                  title: str = "", customer: str = "", project: str = "",
                  estimate_link: str = "", template_used: str = "",
                  status: str = "Черновик", total_amount: float = 0,
                  valid_until: str = "", content_json: str = "",
                  notes: str = "") -> dict:
    if status not in VALID_STATUSES:
        frappe.throw(f"status must be one of {VALID_STATUSES}")
    if not title.strip():
        frappe.throw("title обязателен")

    if name and frappe.db.exists("Construction Proposal", name):
        frappe.has_permission("Construction Proposal", "write", doc=name, throw=True)
        doc = frappe.get_doc("Construction Proposal", name)
        action = "updated"
    else:
        frappe.has_permission("Construction Proposal", "create", throw=True)
        doc = frappe.new_doc("Construction Proposal")
        action = "created"

    doc.title = title.strip()[:140]
    doc.customer = customer or None
    doc.project = project or None
    doc.estimate_link = estimate_link or None
    doc.template_used = template_used or None
    doc.status = status
    doc.total_amount = float(total_amount or 0)
    doc.valid_until = valid_until or None
    doc.content_json = content_json or "{}"
    doc.notes = (notes or "")[:5000]

    doc.save(ignore_permissions=False)
    frappe.db.commit()

    # Инкремент usage_count шаблона
    if action == "created" and template_used:
        try:
            cur = frappe.db.get_value("Proposal Template", template_used, "usage_count") or 0
            frappe.db.set_value("Proposal Template", template_used, "usage_count", cur + 1, update_modified=False)
            frappe.db.commit()
        except Exception:
            pass

    return {"ok": True, "name": doc.name, "action": action}


@frappe.whitelist()
def delete_proposal(name: str) -> dict:
    frappe.has_permission("Construction Proposal", "delete", doc=name, throw=True)
    frappe.delete_doc("Construction Proposal", name, ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True}


# ───────────────────────────── Шаблоны ──────────────────────────────────────


@frappe.whitelist()
def list_templates(active_only: int = 1) -> list[dict]:
    frappe.has_permission("Proposal Template", throw=True)
    filters: dict = {}
    if int(active_only or 0):
        filters["is_active"] = 1
    return frappe.get_all(
        "Proposal Template",
        filters=filters,
        fields=["name", "template_id", "title", "category", "is_active",
                "usage_count", "description"],
        order_by="usage_count DESC, modified DESC",
    )


@frappe.whitelist()
def get_template(name: str) -> dict:
    frappe.has_permission("Proposal Template", "read", doc=name, throw=True)
    doc = frappe.get_doc("Proposal Template", name)
    out = doc.as_dict()
    if doc.default_content_json:
        try:
            out["content"] = json.loads(doc.default_content_json)
        except (json.JSONDecodeError, TypeError):
            out["content"] = None
    return out


@frappe.whitelist()
def save_template(name: str | None = None, template_id: str = "",
                  title: str = "", category: str = "Прочее",
                  description: str = "", is_active: int = 1,
                  default_content_json: str = "") -> dict:
    if not template_id.strip():
        frappe.throw("template_id обязателен")
    if not title.strip():
        frappe.throw("title обязателен")

    if name and frappe.db.exists("Proposal Template", name):
        frappe.has_permission("Proposal Template", "write", doc=name, throw=True)
        doc = frappe.get_doc("Proposal Template", name)
        action = "updated"
    else:
        frappe.has_permission("Proposal Template", "create", throw=True)
        doc = frappe.new_doc("Proposal Template")
        doc.template_id = template_id.strip()
        action = "created"

    doc.title = title.strip()[:140]
    doc.category = category
    doc.description = (description or "")[:1000]
    doc.is_active = int(is_active or 0)
    doc.default_content_json = default_content_json or "{}"

    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"ok": True, "name": doc.name, "action": action}


# ───────────────────────────── Merge data ───────────────────────────────────


@frappe.whitelist()
def get_merge_data(name: str) -> dict:
    """Возвращает данные для подстановки в merge-теги {{customer.name}}, {{project.title}} и т.п."""
    frappe.has_permission("Construction Proposal", "read", doc=name, throw=True)
    doc = frappe.get_doc("Construction Proposal", name)

    data: dict = {
        "proposal": {
            "name": doc.name,
            "title": doc.title,
            "total_amount": float(doc.total_amount or 0),
            "valid_until": str(doc.valid_until) if doc.valid_until else "",
            "today": frappe.utils.formatdate(nowdate(), "dd MMMM yyyy"),
        },
        "company": {
            "name": "ООО «Олимп»",
            "city": "Екатеринбург",
            "inn": frappe.db.get_default("company_inn") or "",
        },
    }

    if doc.customer:
        c = frappe.db.get_value("Customer", doc.customer,
                                ["customer_name", "tax_id"], as_dict=True)
        data["customer"] = {
            "name": c.get("customer_name") if c else doc.customer,
            "inn": c.get("tax_id") if c else "",
        }
    else:
        data["customer"] = {"name": "", "inn": ""}

    if doc.project:
        p = frappe.db.get_value("Construction Project", doc.project,
                                ["title", "location", "contract_amount", "contract_number"], as_dict=True)
        data["project"] = {
            "title": p.get("title") if p else doc.project,
            "location": p.get("location") if p else "",
            "contract_amount": float(p.get("contract_amount") or 0) if p else 0,
            "contract_number": p.get("contract_number") if p else "",
        }
    else:
        data["project"] = {"title": "", "location": "", "contract_amount": 0, "contract_number": ""}

    if doc.estimate_link:
        e = frappe.db.get_value("Estimate", doc.estimate_link,
                                ["our_total", "base_total", "margin_pct", "margin_amount"], as_dict=True)
        if e:
            data["estimate"] = {
                "total": float(e.get("our_total") or 0),
                "base_total": float(e.get("base_total") or 0),
                "margin_pct": float(e.get("margin_pct") or 0),
                "margin_amount": float(e.get("margin_amount") or 0),
            }
        else:
            data["estimate"] = {"total": 0, "base_total": 0, "margin_pct": 0, "margin_amount": 0}
    else:
        data["estimate"] = {"total": 0, "base_total": 0, "margin_pct": 0, "margin_amount": 0}

    return data


# ───────────────────────────── Share-link JWT ───────────────────────────────


def _get_jwt_secret() -> str:
    """Получаем секретный ключ для JWT из site_config или генерируем."""
    secret = frappe.db.get_default("olimp_proposal_jwt_secret")
    if not secret:
        secret = secrets.token_urlsafe(32)
        frappe.db.set_default("olimp_proposal_jwt_secret", secret)
        frappe.db.commit()
    return str(secret)


def _make_token(proposal_name: str, ttl_days: int = 30) -> tuple[str, str]:
    """Генерирует JWT (HS256). Возвращает (token, expires_iso)."""
    import hashlib
    import hmac
    import time

    secret = _get_jwt_secret()
    exp_ts = int(time.time()) + ttl_days * 86400

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": proposal_name, "exp": exp_ts, "type": "proposal_share"}

    def b64url(d: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(d, separators=(",", ":")).encode()).rstrip(b"=").decode()

    h, p = b64url(header), b64url(payload)
    sig = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()

    token = f"{h}.{p}.{sig}"
    expires = frappe.utils.add_to_date(now_datetime(), days=ttl_days)
    return token, str(expires)


def _verify_token(token: str) -> dict | None:
    """Возвращает payload если валидный, иначе None."""
    import hashlib
    import hmac
    import time

    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        h, p, sig = parts
        secret = _get_jwt_secret()
        expected_sig = base64.urlsafe_b64encode(
            hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
        ).rstrip(b"=").decode()
        if not hmac.compare_digest(sig, expected_sig):
            return None

        pad = "=" * (-len(p) % 4)
        payload = json.loads(base64.urlsafe_b64decode(p + pad))
        if payload.get("exp", 0) < int(time.time()):
            return None
        if payload.get("type") != "proposal_share":
            return None
        return payload
    except Exception:
        return None


@frappe.whitelist()
def generate_share_token(name: str, ttl_days: int = 30) -> dict:
    """Создаёт share-token и сохраняет в Construction Proposal."""
    frappe.has_permission("Construction Proposal", "write", doc=name, throw=True)
    doc = frappe.get_doc("Construction Proposal", name)

    token, expires = _make_token(name, int(ttl_days))
    doc.share_token = token
    doc.share_token_expires = expires
    if doc.status == "Черновик":
        doc.status = "Готово к отправке"
    doc.save(ignore_permissions=False)
    frappe.db.commit()

    base_url = frappe.utils.get_url()
    # Замена backend-домена на frontend (если есть)
    return {
        "ok": True, "name": name,
        "token": token, "expires": expires,
        "url_path": f"/p/{token}",
        "full_url_backend": f"{base_url}/p/{token}",
    }


@frappe.whitelist(allow_guest=True, methods=["GET"])
def render_for_public(token: str) -> dict:
    """Публичный endpoint — рендерит КП для клиента по share-ссылке."""
    payload = _verify_token(token)
    if not payload:
        frappe.throw("Ссылка недействительна или истекла", frappe.PermissionError)

    proposal_name = payload["sub"]
    if not frappe.db.exists("Construction Proposal", proposal_name):
        frappe.throw("КП не найдено", frappe.DoesNotExistError)

    doc = frappe.get_doc("Construction Proposal", proposal_name)

    # Учёт просмотра (только не от менеджера-владельца если он на guest-сессии)
    try:
        if not doc.first_viewed_at:
            frappe.db.set_value("Construction Proposal", proposal_name, "first_viewed_at", now_datetime(), update_modified=False)
        frappe.db.set_value("Construction Proposal", proposal_name, "view_count", int(doc.view_count or 0) + 1, update_modified=False)
        if doc.status == "Отправлено":
            frappe.db.set_value("Construction Proposal", proposal_name, "status", "Просмотрено клиентом", update_modified=False)
        frappe.db.commit()
    except Exception:
        pass

    # Merge data
    merge = get_merge_data_internal(doc)

    return {
        "ok": True,
        "name": doc.name,
        "title": doc.title,
        "customer_name": merge["customer"]["name"],
        "project_title": merge["project"]["title"],
        "total_amount": float(doc.total_amount or 0),
        "valid_until": str(doc.valid_until) if doc.valid_until else None,
        "content": json.loads(doc.content_json or "{}"),
        "merge": merge,
        "status": doc.status,
        "already_signed": bool(doc.signed_at),
        "signed_by_name": doc.signed_by_name,
        "signed_at": str(doc.signed_at) if doc.signed_at else None,
    }


def get_merge_data_internal(doc) -> dict:
    """Внутренняя версия get_merge_data без permission-check."""
    data: dict = {
        "proposal": {
            "name": doc.name, "title": doc.title,
            "total_amount": float(doc.total_amount or 0),
            "valid_until": str(doc.valid_until) if doc.valid_until else "",
            "today": frappe.utils.formatdate(nowdate(), "dd MMMM yyyy"),
        },
        "company": {"name": "ООО «Олимп»", "city": "Екатеринбург", "inn": ""},
        "customer": {"name": "", "inn": ""},
        "project": {"title": "", "location": "", "contract_amount": 0, "contract_number": ""},
        "estimate": {"total": 0, "base_total": 0, "margin_pct": 0, "margin_amount": 0},
    }

    if doc.customer:
        c = frappe.db.get_value("Customer", doc.customer,
                                ["customer_name", "tax_id"], as_dict=True)
        if c:
            data["customer"] = {"name": c.get("customer_name") or doc.customer,
                                "inn": c.get("tax_id") or ""}
    if doc.project:
        p = frappe.db.get_value("Construction Project", doc.project,
                                ["title", "location", "contract_amount", "contract_number"], as_dict=True)
        if p:
            data["project"] = {
                "title": p.get("title") or doc.project,
                "location": p.get("location") or "",
                "contract_amount": float(p.get("contract_amount") or 0),
                "contract_number": p.get("contract_number") or "",
            }
    if doc.estimate_link:
        e = frappe.db.get_value("Estimate", doc.estimate_link,
                                ["our_total", "base_total", "margin_pct", "margin_amount"], as_dict=True)
        if e:
            data["estimate"] = {
                "total": float(e.get("our_total") or 0),
                "base_total": float(e.get("base_total") or 0),
                "margin_pct": float(e.get("margin_pct") or 0),
                "margin_amount": float(e.get("margin_amount") or 0),
            }
    return data


@frappe.whitelist(allow_guest=True, methods=["POST"])
def submit_signature(token: str, signer_name: str = "",
                     signature_data_url: str = "") -> dict:
    """Публичный endpoint — клиент подписывает КП."""
    payload = _verify_token(token)
    if not payload:
        frappe.throw("Ссылка недействительна или истекла", frappe.PermissionError)
    if not signer_name.strip():
        frappe.throw("Укажите ФИО подписанта")
    if not signature_data_url or not signature_data_url.startswith("data:image/"):
        frappe.throw("Подпись отсутствует")

    proposal_name = payload["sub"]
    if not frappe.db.exists("Construction Proposal", proposal_name):
        frappe.throw("КП не найдено", frappe.DoesNotExistError)

    ip = (frappe.local.request_ip or "")[:140] if hasattr(frappe.local, "request_ip") else ""

    # Ограничим размер base64 (до 200KB)
    if len(signature_data_url) > 300_000:
        frappe.throw("Подпись слишком большая")

    frappe.db.set_value("Construction Proposal", proposal_name, {
        "signed_at": now_datetime(),
        "signed_by_name": signer_name.strip()[:140],
        "signed_by_ip": ip,
        "signature_data_url": signature_data_url[:300_000],
        "status": "Согласовано",
    }, update_modified=True)
    frappe.db.commit()

    # Telegram-уведомление директору
    try:
        from olimp_construction.telegram_utils import send_message
        doc = frappe.get_doc("Construction Proposal", proposal_name)
        send_message(
            f"✅ <b>КП согласовано клиентом</b>\n\n"
            f"<b>{doc.title}</b>\n"
            f"Подписал: {signer_name}\n"
            f"Сумма: {doc.total_amount:,.0f} ₽".replace(",", " ")
        )
    except Exception:
        pass

    return {"ok": True, "name": proposal_name, "signed_at": str(now_datetime())}


@frappe.whitelist()
def mark_sent(name: str) -> dict:
    """Менеджер отметил что отправил клиенту."""
    frappe.has_permission("Construction Proposal", "write", doc=name, throw=True)
    frappe.db.set_value("Construction Proposal", name, {
        "sent_at": now_datetime(),
        "status": "Отправлено",
    })
    frappe.db.commit()
    return {"ok": True}


# ───────────────────────────── Summary ──────────────────────────────────────


@frappe.whitelist()
def get_summary(days: int = 90) -> dict:
    """Сводка для дашборда КП."""
    frappe.has_permission("Construction Proposal", throw=True)

    totals = frappe.db.sql("""
        SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN status='Черновик' THEN 1 END) AS draft,
          COUNT(CASE WHEN status='Отправлено' OR status='Просмотрено клиентом' THEN 1 END) AS pending,
          COUNT(CASE WHEN status='Согласовано' THEN 1 END) AS approved,
          COUNT(CASE WHEN status='Отклонено' THEN 1 END) AS rejected,
          SUM(CASE WHEN status='Согласовано' THEN total_amount ELSE 0 END) AS approved_amount,
          SUM(total_amount) AS total_amount
        FROM `tabConstruction Proposal`
        WHERE modified >= DATE_SUB(CURDATE(), INTERVAL %(d)s DAY)
    """, {"d": int(days)}, as_dict=True)[0]

    return {
        "total": int(totals["total"] or 0),
        "draft": int(totals["draft"] or 0),
        "pending": int(totals["pending"] or 0),
        "approved": int(totals["approved"] or 0),
        "rejected": int(totals["rejected"] or 0),
        "approved_amount": float(totals["approved_amount"] or 0),
        "total_amount": float(totals["total_amount"] or 0),
        "conversion_pct": (
            int(totals["approved"]) / int(totals["total"]) * 100
            if int(totals["total"] or 0) > 0 else 0
        ),
    }
