"""API для Foreman Check-in — отметка прораба на объекте с GPS+фото+погодой.

Идея из subagent-разведки Bitrix24 (mobile checkin). Open-Meteo даёт погоду
по GPS без ключа — для бесплатного weather auto-fetch.
"""
from __future__ import annotations

import math

import frappe
import requests
from frappe.utils import now_datetime


# Open-Meteo — бесплатный, без регистрации, без ключа
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _fetch_weather(lat: float, lng: float) -> tuple[str | None, float | None]:
    """Подтягивает текущую погоду по координатам через Open-Meteo."""
    try:
        r = requests.get(
            OPEN_METEO_URL,
            params={
                "latitude": lat, "longitude": lng,
                "current": "temperature_2m,weather_code,wind_speed_10m",
                "timezone": "auto",
            },
            timeout=4,
        )
        r.raise_for_status()
        d = r.json()
        cur = d.get("current") or {}
        temp = cur.get("temperature_2m")
        code = cur.get("weather_code")
        wind = cur.get("wind_speed_10m")
        # Простая интерпретация WMO weather_code
        weather_map = {
            0: "Ясно", 1: "Преимущественно ясно", 2: "Переменная облачность", 3: "Пасмурно",
            45: "Туман", 48: "Туман с инеем",
            51: "Лёгкая морось", 53: "Морось", 55: "Сильная морось",
            61: "Лёгкий дождь", 63: "Дождь", 65: "Сильный дождь",
            71: "Лёгкий снег", 73: "Снег", 75: "Сильный снег",
            80: "Ливень", 81: "Сильный ливень", 82: "Очень сильный ливень",
            95: "Гроза", 96: "Гроза с градом", 99: "Сильная гроза с градом",
        }
        weather_text = weather_map.get(code, f"Код {code}")
        if wind is not None:
            weather_text += f", ветер {round(wind, 1)} м/с"
        return weather_text, float(temp) if temp is not None else None
    except Exception as e:
        frappe.logger().info(f"Open-Meteo не сработал: {e}")
        return None, None


def _haversine_m(lat1, lng1, lat2, lng2) -> int:
    """Расстояние в метрах между двумя точками (haversine)."""
    R = 6371000  # радиус Земли в метрах
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return int(R * c)


@frappe.whitelist()
def create_check_in(
    project: str,
    foreman_name: str,
    kind: str = "Начало смены",
    lat: float | str | None = None,
    lng: float | str | None = None,
    accuracy_m: float | str | None = None,
    photo_url: str | None = None,
    photo_caption: str | None = None,
    workers_count: int | str = 0,
    engineers_count: int | str = 0,
    equipment_on_site: str | None = None,
    notes: str | None = None,
) -> dict:
    """Создаёт запись чек-ина прораба с авто-обогащением: weather + distance."""
    frappe.has_permission("Foreman Check-in", "create", throw=True)
    if not project or not foreman_name:
        frappe.throw("Укажи project и foreman_name")

    lat_f = float(lat) if lat else None
    lng_f = float(lng) if lng else None

    # Weather auto-fetch
    weather_text, temp_c = None, None
    if lat_f and lng_f:
        weather_text, temp_c = _fetch_weather(lat_f, lng_f)

    # Distance от объекта (если у проекта есть координаты — поля могут отсутствовать)
    distance_m = None
    if lat_f and lng_f:
        try:
            proj = frappe.db.sql(
                """SELECT location_lat, location_lng FROM `tabConstruction Project`
                   WHERE name = %(n)s""",
                {"n": project}, as_dict=True,
            )
            if proj and proj[0].get("location_lat") and proj[0].get("location_lng"):
                distance_m = _haversine_m(
                    float(proj[0]["location_lat"]), float(proj[0]["location_lng"]),
                    lat_f, lng_f,
                )
        except Exception:
            pass  # поля location_lat/lng не существуют — нормально

    doc = frappe.get_doc({
        "doctype": "Foreman Check-in",
        "project": project,
        "foreman_name": foreman_name,
        "check_in_time": now_datetime(),
        "kind": kind,
        "weather": weather_text or "",
        "temperature_c": temp_c,
        "lat": lat_f,
        "lng": lng_f,
        "accuracy_m": float(accuracy_m) if accuracy_m else None,
        "photo_url": photo_url or None,
        "photo_caption": (photo_caption or "")[:500],
        "workers_count": int(workers_count or 0),
        "engineers_count": int(engineers_count or 0),
        "equipment_on_site": (equipment_on_site or "")[:500],
        "notes": (notes or "")[:1000],
        "distance_from_project_m": distance_m,
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "ok": True,
        "name": doc.name,
        "weather": weather_text,
        "temperature_c": temp_c,
        "distance_from_project_m": distance_m,
        "project": project,
    }


@frappe.whitelist()
def check_out(name: str) -> dict:
    """Закрытие смены — проставляем check_out_time."""
    frappe.has_permission("Foreman Check-in", "write", doc=name, throw=True)
    frappe.db.set_value("Foreman Check-in", name,
                       "check_out_time", now_datetime(),
                       update_modified=False)
    frappe.db.commit()
    return {"ok": True, "name": name}


@frappe.whitelist()
def get_today(project: str | None = None) -> list[dict]:
    """Чек-ины за сегодня (для дашборда «кто сейчас на объектах»)."""
    frappe.has_permission("Foreman Check-in", throw=True)
    filters = "WHERE DATE(check_in_time) = CURDATE()"
    params = {}
    if project:
        filters += " AND project = %(p)s"
        params["p"] = project
    return frappe.db.sql(
        f"""SELECT name, foreman_name, project, kind, check_in_time, check_out_time,
                   weather, temperature_c, lat, lng,
                   distance_from_project_m, workers_count, engineers_count,
                   photo_url
            FROM `tabForeman Check-in`
            {filters}
            ORDER BY check_in_time DESC""",
        params, as_dict=True,
    )


@frappe.whitelist()
def notify_arrival(project: str, foreman_name: str = "",
                   eta_minutes: int = 0, custom_chat_id: str = "") -> dict:
    """«Я выехал» / «Я на объекте» — one-tap уведомление заказчику в Telegram.

    Идея — Housecall Pro / Jobber "On My Way" текст.
    Получатель определяется:
    1. Явный custom_chat_id (если передан — для тестов)
    2. Custom Field `telegram_chat_id` на Customer проекта (TODO будущий релиз)
    3. Fallback на TELEGRAM_CHAT_ID директора (Дима получает уведомление о том,
       что прораб выехал)

    eta_minutes — если 0, отправляется «Я уже на объекте», иначе «Выехал, буду через N мин».
    """
    from olimp_construction.telegram_utils import send_message

    frappe.has_permission("Construction Project", "read", doc=project, throw=True)
    if not frappe.db.exists("Construction Project", project):
        frappe.throw(f"Проект {project} не найден")

    proj = frappe.db.get_value(
        "Construction Project", project,
        ["title", "customer", "location", "foreman"], as_dict=True,
    )

    foreman = (foreman_name or "").strip() or proj.foreman or "Прораб"
    location = proj.location or "объект"
    project_title = proj.title or project

    if eta_minutes and int(eta_minutes) > 0:
        text = (
            f"🚐 <b>Бригада выехала</b>\n\n"
            f"<b>Прораб:</b> {foreman}\n"
            f"<b>Объект:</b> {project_title}\n"
            f"<b>Адрес:</b> {location}\n"
            f"<b>Прибытие через:</b> ~{int(eta_minutes)} мин\n"
            f"<i>Можете встретить или подготовить доступ.</i>"
        )
    else:
        text = (
            f"📍 <b>Бригада на объекте</b>\n\n"
            f"<b>Прораб:</b> {foreman}\n"
            f"<b>Объект:</b> {project_title}\n"
            f"<b>Адрес:</b> {location}\n"
            f"<i>Приступаем к работам.</i>"
        )

    # Получатель: custom_chat_id → customer.telegram_chat_id (если есть поле) → fallback директор
    target_chat: str | None = None
    if custom_chat_id and custom_chat_id.strip():
        target_chat = custom_chat_id.strip()
    elif proj.customer and frappe.db.has_column("Customer", "telegram_chat_id"):
        try:
            target_chat = frappe.db.get_value("Customer", proj.customer, "telegram_chat_id")
        except Exception:
            target_chat = None

    sent = send_message(text, chat_id=target_chat)
    return {
        "ok": True, "sent": sent, "project": project,
        "fallback_used": not target_chat and sent,
        "preview": text,
    }


@frappe.whitelist()
def get_active_now() -> list[dict]:
    """Кто сейчас на объекте (без check_out_time)."""
    frappe.has_permission("Foreman Check-in", throw=True)
    return frappe.db.sql(
        """SELECT name, foreman_name, project, check_in_time,
                  weather, temperature_c, workers_count, distance_from_project_m
           FROM `tabForeman Check-in`
           WHERE check_out_time IS NULL
             AND DATE(check_in_time) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
           ORDER BY check_in_time DESC""",
        as_dict=True,
    )
