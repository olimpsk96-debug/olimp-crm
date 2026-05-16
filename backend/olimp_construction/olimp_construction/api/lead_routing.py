"""Lead routing (AmoCRM/Bitrix24-pattern):
- Round-robin auto-assignment при создании Deal через webhook/UI
- Missed-Lead Watchdog: лид без ответа >15 мин → flag is_missed + Telegram директору

Идеи из subagent-разведки Bitrix24/AmoCRM 14.05.2026.
"""
from __future__ import annotations

import frappe
from frappe.utils import now_datetime

from olimp_construction.telegram_utils import send_message


# Конфиг: какие роли получают новые лиды (round-robin между ними)
ELIGIBLE_ROLES = ("Тендерный менеджер", "Главный инженер", "System Manager")

# Сколько минут без ответа = пропущенный лид
MISSED_THRESHOLD_MINUTES = 15


def get_eligible_users() -> list[str]:
    """Список email активных пользователей с подходящей ролью.

    Сортировка по email — стабильная для round-robin.
    """
    users = frappe.db.sql(
        """SELECT DISTINCT u.name
           FROM `tabUser` u
           INNER JOIN `tabHas Role` hr ON hr.parent = u.name
           WHERE u.enabled = 1
             AND u.name NOT IN ('Guest', 'Administrator')
             AND hr.role IN %(roles)s
           ORDER BY u.name ASC""",
        {"roles": ELIGIBLE_ROLES}, as_list=True,
    )
    return [u[0] for u in users] or ["Administrator"]


def pick_next_assignee() -> str:
    """Round-robin: ищем менеджера с наименьшим числом активных лидов сегодня."""
    users = get_eligible_users()
    if not users:
        return "Administrator"

    # Считаем сколько лидов сегодня уже назначено каждому
    counts = frappe.db.sql(
        """SELECT assigned_to, COUNT(*) AS cnt
           FROM `tabDeal`
           WHERE DATE(assigned_at) = CURDATE()
             AND assigned_to IS NOT NULL
           GROUP BY assigned_to""",
        as_dict=True,
    )
    count_map = {r["assigned_to"]: r["cnt"] for r in counts}

    # Round-robin: меньше всех получил сегодня → ему
    return min(users, key=lambda u: count_map.get(u, 0))


@frappe.whitelist()
def auto_assign(deal_name: str) -> dict:
    """Авто-назначить менеджера на сделку round-robin."""
    if not frappe.db.exists("Deal", deal_name):
        frappe.throw(f"Deal {deal_name} не найден")

    doc = frappe.get_doc("Deal", deal_name)
    if doc.assigned_to:
        return {"ok": True, "already_assigned": doc.assigned_to}

    assignee = pick_next_assignee()
    doc.assigned_to = assignee
    doc.assigned_at = now_datetime()
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    # Telegram-уведомление новому ответственному (если у нас есть его chat_id)
    try:
        msg = (
            f"🎯 <b>Новый лид назначен на тебя</b>\n\n"
            f"<b>{doc.title or doc.name}</b>\n"
            f"Клиент: {doc.customer or '—'}\n"
            f"Контакт: {doc.contact_name or '—'}\n"
            f"Источник: {doc.source or '—'}\n\n"
            f"<a href='http://erp.olimp-ural.ru/app/deal/{doc.name}'>Открыть в CRM →</a>"
        )
        send_message(msg)
    except Exception as e:
        frappe.logger().warning(f"Telegram alert failed: {e}")

    return {"ok": True, "deal": deal_name, "assigned_to": assignee}


def check_missed_leads() -> dict:
    """Daily cron / on-demand: отметить пропущенные лиды.

    Пропущен = создан > 15 минут назад, status="Лид", first_response_at пуст.
    """
    rows = frappe.db.sql(
        """SELECT name, title, customer, assigned_to, creation
           FROM `tabDeal`
           WHERE status = 'Лид'
             AND (first_response_at IS NULL OR first_response_at = '0001-01-01 00:00:00')
             AND creation < DATE_SUB(NOW(), INTERVAL %(min)s MINUTE)
             AND (is_missed = 0 OR is_missed IS NULL)""",
        {"min": MISSED_THRESHOLD_MINUTES}, as_dict=True,
    )

    now = now_datetime()
    flagged = 0
    for r in rows:
        minutes_since = int((now - r["creation"]).total_seconds() / 60)
        frappe.db.set_value("Deal", r["name"],
                          {"is_missed": 1, "missed_minutes": minutes_since},
                          update_modified=False)
        flagged += 1

        # Эскалация директору
        try:
            send_message(
                f"⚠️ <b>Пропущенный лид</b>\n\n"
                f"<b>{r['title'] or r['name']}</b>\n"
                f"Клиент: {r['customer'] or '—'}\n"
                f"Назначен: {r['assigned_to'] or '— (не распределён!)'}\n"
                f"Молчание: <b>{minutes_since} минут</b>\n\n"
                f"<a href='http://erp.olimp-ural.ru/app/deal/{r['name']}'>Открыть →</a>"
            )
        except Exception:
            pass

    frappe.db.commit()
    return {"ok": True, "checked": len(rows), "flagged": flagged}


@frappe.whitelist()
def refresh_missed() -> dict:
    """Запуск проверки missed leads вручную."""
    if "System Manager" not in frappe.get_roles(frappe.session.user) and \
       "Главный инженер" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager / Главный инженер", frappe.PermissionError)
    return check_missed_leads()


@frappe.whitelist()
def get_team_workload() -> list[dict]:
    """KPI workload по менеджерам — кто сколько активных лидов ведёт."""
    frappe.has_permission("Deal", throw=True)
    rows = frappe.db.sql(
        """SELECT
              assigned_to AS user,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'Лид' THEN 1 ELSE 0 END) AS new_count,
              SUM(CASE WHEN status NOT IN ('Закрыт выигран','Закрыт проигран') THEN 1 ELSE 0 END) AS open_count,
              SUM(CASE WHEN status = 'Закрыт выигран' THEN 1 ELSE 0 END) AS won_count,
              SUM(CASE WHEN is_missed = 1 THEN 1 ELSE 0 END) AS missed_count,
              SUM(CASE WHEN is_rotting = 1 THEN 1 ELSE 0 END) AS rotting_count,
              COALESCE(SUM(amount_estimated), 0) AS total_amount
           FROM `tabDeal`
           WHERE assigned_to IS NOT NULL AND assigned_to != ''
             AND creation >= DATE_SUB(NOW(), INTERVAL 90 DAY)
           GROUP BY assigned_to
           ORDER BY open_count DESC""",
        as_dict=True,
    )
    return rows
