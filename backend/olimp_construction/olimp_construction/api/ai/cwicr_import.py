"""Импорт обогащённых данных CWICR из parquet файлов.

CWICR содержит:
- 6 670 уникальных resource_code (общий справочник для 30 регионов мира)
- Цены resource_price_per_unit_current (разные по регионам)
- Нормативная часть для work_items (НЕ для ресурсов)

Что обновляем в Catalog Resource:
1. price_avg / price_min / price_max — текущие цены из CWICR региона
2. machine_class_name — для is_machine=1 ресурсов
3. resource_name — если в БД пусто (импорт мог быть неполный)

Запуск (System Manager):
  curl -X POST http://erp.olimp-ural.ru/api/method/olimp_construction.api.ai.cwicr_import.import_from_parquet \\
    -d 'parquet_path=/tmp/RU_SPB.parquet&region=RU_SPB'
"""
from __future__ import annotations

import os

import frappe
from frappe.utils import flt


@frappe.whitelist()
def import_from_parquet(parquet_path: str, region: str = "RU_SPB",
                        update_prices: int | bool = 1,
                        update_machine_class: int | bool = 1) -> dict:
    """Обновляет Catalog Resource из CWICR parquet файла.

    parquet_path: путь к файлу в контейнере (например, /tmp/RU_SPB.parquet)
    region: тег региона (RU_SPB, UK_LDN, US_USA) для логирования
    update_prices: обновлять ли price_avg
    update_machine_class: обновлять ли machine_class_name
    """
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager", frappe.PermissionError)

    if not os.path.exists(parquet_path):
        frappe.throw(f"Файл не найден: {parquet_path}")

    try:
        import pyarrow.parquet as pq
        import pandas as pd
    except ImportError:
        frappe.throw("pyarrow и pandas не установлены. pip install pyarrow pandas")

    # Читаем только нужные колонки чтобы экономить память
    cols = [
        "resource_code", "resource_name", "resource_unit",
        "is_labor", "is_material", "is_machine",
        "resource_price_per_unit_current",
        "machine_class3_name",
        "parent_category", "category_type",
    ]
    # Не все колонки могут существовать
    available_cols = pq.ParquetFile(parquet_path).schema_arrow.names
    cols = [c for c in cols if c in available_cols]

    t = pq.read_table(parquet_path, columns=cols)
    df = t.to_pandas()

    # Уникальный resource_code → агрегируем
    df = df.dropna(subset=["resource_code"])
    df = df[df["resource_code"] != ""]

    agg_dict: dict = {
        "resource_name": "first",
        "resource_unit": "first",
    }
    if "is_labor" in df.columns:
        agg_dict["is_labor"] = "max"
    if "is_material" in df.columns:
        agg_dict["is_material"] = "max"
    if "is_machine" in df.columns:
        agg_dict["is_machine"] = "max"
    if "resource_price_per_unit_current" in df.columns:
        agg_dict["resource_price_per_unit_current"] = "mean"
    if "machine_class3_name" in df.columns:
        agg_dict["machine_class3_name"] = "first"

    agg = df.groupby("resource_code").agg(agg_dict).reset_index()

    total_in_parquet = len(agg)
    total_in_db = frappe.db.count("Catalog Resource")

    # Получим существующие записи batch'ом для быстрого lookup
    existing = {}
    rows = frappe.db.sql(
        "SELECT name, resource_code, resource_name, price_avg, machine_class_name FROM `tabCatalog Resource`",
        as_dict=True,
    )
    for r in rows:
        existing[r["resource_code"]] = r

    updated_price = 0
    updated_machine = 0
    not_found = 0
    skipped = 0

    update_prices_b = bool(int(update_prices or 0))
    update_machine_b = bool(int(update_machine_class or 0))

    # Batch updates через SET
    for _, row in agg.iterrows():
        code = row["resource_code"]
        if code not in existing:
            not_found += 1
            continue

        db_row = existing[code]
        updates: dict = {}

        if update_prices_b:
            new_price = flt(row.get("resource_price_per_unit_current") or 0)
            old_price = flt(db_row.get("price_avg") or 0)
            if new_price > 0 and abs(new_price - old_price) > 0.01:
                updates["price_avg"] = round(new_price, 2)
                updated_price += 1

        if update_machine_b and row.get("is_machine") and row.get("machine_class3_name"):
            mc = str(row.get("machine_class3_name") or "").strip()[:140]
            if mc and not db_row.get("machine_class_name"):
                updates["machine_class_name"] = mc
                updated_machine += 1

        if updates:
            frappe.db.set_value("Catalog Resource", db_row["name"], updates, update_modified=False)
        else:
            skipped += 1

    frappe.db.commit()

    return {
        "ok": True,
        "region": region,
        "parquet_path": parquet_path,
        "total_in_parquet": total_in_parquet,
        "total_in_db_before": total_in_db,
        "updated_price": updated_price,
        "updated_machine_class": updated_machine,
        "not_found_in_db": not_found,
        "skipped_no_change": skipped,
    }


@frappe.whitelist()
def import_work_items(parquet_path: str, batch_size: int = 5000) -> dict:
    """Импорт 55 719 уникальных работ (rate_code) из CWICR в Catalog Work Item.

    Использует прямой SQL INSERT IGNORE (батчами), потому что через
    frappe.get_doc().insert() заняло бы час+. Текущий подход — ~2-3 минуты.

    parquet_path: путь к файлу в контейнере (/tmp/RU_SPB.parquet)
    batch_size: размер батча для bulk insert
    """
    import json
    from frappe.utils import now_datetime

    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager", frappe.PermissionError)

    if not os.path.exists(parquet_path):
        frappe.throw(f"Файл не найден: {parquet_path}")

    try:
        import pyarrow.parquet as pq
    except ImportError:
        frappe.throw("pyarrow не установлен")

    # Читаем нужные колонки
    cols = [
        "rate_code", "rate_final_name", "rate_unit",
        "category_type", "department_name", "section_name", "subsection_name",
        "row_type", "is_scope", "is_abstract", "work_composition_text",
    ]
    available = pq.ParquetFile(parquet_path).schema_arrow.names
    cols = [c for c in cols if c in available]

    t = pq.read_table(parquet_path, columns=cols)
    df = t.to_pandas()

    # Группируем по rate_code, берём первое непустое значение для каждой колонки
    df = df.dropna(subset=["rate_code"])
    df = df[df["rate_code"] != ""]

    agg = df.groupby("rate_code").agg({
        "rate_final_name": "first",
        "rate_unit": "first",
        "category_type": "first",
        "department_name": "first",
        "section_name": "first",
        "subsection_name": "first",
        "row_type": "first",
        "is_scope": "max",
        "is_abstract": "max",
        "work_composition_text": "first",
    }).reset_index()

    total = len(agg)
    now = now_datetime()
    user = frappe.session.user

    # Получим существующие rate_code чтобы пропустить
    existing = set(frappe.db.sql_list("SELECT rate_code FROM `tabCatalog Work Item`") or [])

    inserted = 0
    skipped = 0
    errors = 0

    # Подготовим INSERT IGNORE батчами
    insert_sql = """
        INSERT IGNORE INTO `tabCatalog Work Item`
        (name, creation, modified, modified_by, owner, docstatus, idx,
         rate_code, rate_name, rate_unit, category_type, department_name,
         section_name, subsection_name, row_type, is_scope, is_abstract,
         work_composition_text, source, usage_count)
        VALUES %s
    """

    def _s(v, maxlen=140):
        if v is None:
            return None
        s = str(v).strip()
        return s[:maxlen] if s else None

    batch_rows = []
    for _, row in agg.iterrows():
        rate_code = _s(row["rate_code"], 140)
        if not rate_code or rate_code in existing:
            skipped += 1
            continue

        batch_rows.append((
            rate_code,                                 # name (autoname=rate_code)
            now, now, user, user, 0, 0,                # creation/modified/...
            rate_code,
            _s(row.get("rate_final_name"), 1000),
            _s(row.get("rate_unit"), 50),
            _s(row.get("category_type"), 200),
            _s(row.get("department_name"), 500),
            _s(row.get("section_name"), 500),
            _s(row.get("subsection_name"), 500),
            _s(row.get("row_type"), 50),
            1 if row.get("is_scope") else 0,
            1 if row.get("is_abstract") else 0,
            _s(row.get("work_composition_text"), 65000),
            "CWICR RU_SPB",
            0,
        ))

        if len(batch_rows) >= int(batch_size):
            try:
                # Frappe не любит сырой VALUES %s — делаем сами параметризацию
                placeholders = ",".join(["(" + ",".join(["%s"] * 20) + ")"] * len(batch_rows))
                flat = [v for row in batch_rows for v in row]
                frappe.db.sql(insert_sql.replace("%s", placeholders), tuple(flat))
                inserted += len(batch_rows)
                batch_rows.clear()
            except Exception as e:
                errors += len(batch_rows)
                frappe.logger().error(f"CWICR bulk insert ошибка: {str(e)[:300]}")
                batch_rows.clear()

    # Финальный батч
    if batch_rows:
        try:
            placeholders = ",".join(["(" + ",".join(["%s"] * 20) + ")"] * len(batch_rows))
            flat = [v for row in batch_rows for v in row]
            frappe.db.sql(insert_sql.replace("%s", placeholders), tuple(flat))
            inserted += len(batch_rows)
        except Exception as e:
            errors += len(batch_rows)
            frappe.logger().error(f"CWICR final batch error: {str(e)[:300]}")

    frappe.db.commit()

    return {
        "ok": True,
        "total_in_parquet": total,
        "inserted": inserted,
        "skipped_existing": skipped,
        "errors": errors,
        "total_in_db_after": frappe.db.count("Catalog Work Item"),
    }


@frappe.whitelist()
def get_import_status() -> dict:
    """Статус обогащения Catalog Resource данными CWICR."""
    frappe.has_permission("Catalog Resource", throw=True)

    rows = frappe.db.sql(
        """SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN price_avg > 0 THEN 1 ELSE 0 END) AS with_price,
              SUM(CASE WHEN machine_class_name IS NOT NULL AND machine_class_name != '' THEN 1 ELSE 0 END) AS with_machine_class,
              SUM(CASE WHEN labor_hours_per_unit > 0 THEN 1 ELSE 0 END) AS with_labor_norms,
              SUM(CASE WHEN resource_type = 'Material' THEN 1 ELSE 0 END) AS materials,
              SUM(CASE WHEN resource_type = 'Equipment' THEN 1 ELSE 0 END) AS equipment,
              SUM(CASE WHEN resource_type = 'Labor' THEN 1 ELSE 0 END) AS labor,
              SUM(CASE WHEN resource_type = 'Abstract Material' THEN 1 ELSE 0 END) AS abstract,
              AVG(price_avg) AS avg_price
           FROM `tabCatalog Resource`""",
        as_dict=True,
    )[0]
    return {k: (float(v) if isinstance(v, (int, float)) else v) for k, v in rows.items()}
