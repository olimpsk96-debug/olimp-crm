"""Seed-функция: создаёт 5 базовых Work Template под профиль ОЛИМП.

Запуск:
  bench --site erp.olimp-ural.ru execute olimp_construction.api.ai.seed_work_templates.seed_all
  или через curl POST /api/method/olimp_construction.api.ai.seed_work_templates.seed_all
"""
from __future__ import annotations

import json

import frappe


TEMPLATES = [
    {
        "template_id": "akz_rvs_steel_tank",
        "title": "АКЗ резервуара (стальной РВС)",
        "category": "АКЗ",
        "base_unit": "м²",
        "typical_volume_min": 200,
        "typical_volume_max": 3500,
        "keywords": "акз, антикоррозия, антикоррозийная, защита, резервуар, рвс, ёмкость, емкость, бак, цистерна, окраска, грунт, эмаль",
        "description": "Полный цикл АКЗ внутренней и/или наружной поверхности стального резервуара. Требуется уточнить степень очистки (Sa2/Sa2.5/Sa3), толщину системы покрытия, наличие действующего производства.",
        "stages": [
            {"title": "Леса/подмости (монтаж + демонтаж)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.15, "materials_json": '{}',
             "gesn_ref": "ГЭСНм 08-02-394-01"},
            {"title": "Пескоструйная очистка до Sa 2.5", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.25, "materials_json": '{"abrasive_kg": 35}',
             "gesn_ref": "ГЭСН 13-03-002-04",
             "notes": "Расход абразива зависит от состояния поверхности (25-50 кг/м²)"},
            {"title": "Обеспыливание, обезжиривание", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.04, "materials_json": '{"solvent_l": 0.05}',
             "gesn_ref": ""},
            {"title": "Грунтование (1 слой, 80 мкм)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.08, "materials_json": '{"primer_kg": 0.35}',
             "gesn_ref": "ГЭСН 13-03-004-01"},
            {"title": "Промежуточный слой эмали (120 мкм)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.10, "materials_json": '{"paint_kg": 0.45}',
             "gesn_ref": "ГЭСН 13-03-004-04"},
            {"title": "Финишный слой эмали (100 мкм)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.10, "materials_json": '{"paint_kg": 0.40}',
             "gesn_ref": "ГЭСН 13-03-004-04"},
            {"title": "Контроль толщины и адгезии (3-5% площади)", "unit": "м²", "norm_per_base_unit": 0.05,
             "labor_hours_per_unit": 0.10, "materials_json": '{}',
             "gesn_ref": "",
             "notes": "Толщиномер + крест-надрез + протокол"},
        ],
    },

    {
        "template_id": "cfrp_slab_reinforcement",
        "title": "Усиление плиты углеволокном (CFRP)",
        "category": "Усиление конструкций",
        "base_unit": "м²",
        "typical_volume_min": 30,
        "typical_volume_max": 500,
        "keywords": "усиление, углеволокно, углеткань, углепластик, cfrp, frp, плита, перекрытие, балка, ригель, колонна, эпоксидная, sika, mapei",
        "description": "Внешнее армирование железобетонных конструкций углеродной тканью на эпоксидной матрице. Используется при увеличении нагрузок, дефектах сечения, восстановлении после пожара.",
        "stages": [
            {"title": "Подготовка поверхности (шлифовка, обеспыливание)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.30, "materials_json": '{}',
             "gesn_ref": ""},
            {"title": "Праймирование (грунт эпоксидный)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.10, "materials_json": '{"primer_kg": 0.35}',
             "gesn_ref": ""},
            {"title": "Шпатлёвка для выравнивания (при необходимости)", "unit": "м²", "norm_per_base_unit": 0.5,
             "labor_hours_per_unit": 0.20, "materials_json": '{"putty_kg": 1.2}',
             "gesn_ref": "",
             "notes": "Только при больших неровностях (>3мм)"},
            {"title": "Раскрой углеткани", "unit": "м²", "norm_per_base_unit": 1.10,
             "labor_hours_per_unit": 0.08, "materials_json": '{"cfrp_fabric_m2": 1.1}',
             "gesn_ref": "",
             "notes": "10% запас на раскрой и нахлёсты"},
            {"title": "Нанесение эпоксидной смолы (1-й слой)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.12, "materials_json": '{"epoxy_resin_kg": 0.6}',
             "gesn_ref": ""},
            {"title": "Укладка углеткани, прокатка валиком", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.20, "materials_json": '{}',
             "gesn_ref": ""},
            {"title": "Пропитка смолой (2-й слой)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.12, "materials_json": '{"epoxy_resin_kg": 0.5}',
             "gesn_ref": ""},
            {"title": "Финишное защитное покрытие (опционально)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.08, "materials_json": '{"topcoat_kg": 0.2}',
             "gesn_ref": "",
             "notes": "Огнезащита/УФ-защита"},
            {"title": "Контроль качества (адгезия pull-off)", "unit": "точка", "norm_per_base_unit": 0.05,
             "labor_hours_per_unit": 0.50, "materials_json": '{}',
             "gesn_ref": "",
             "notes": "1 точка на каждые 20м²; ≥2.5 МПа"},
        ],
    },

    {
        "template_id": "fire_protection_steel_structure",
        "title": "Огнезащита металлоконструкций",
        "category": "Огнезащита",
        "base_unit": "м²",
        "typical_volume_min": 100,
        "typical_volume_max": 5000,
        "keywords": "огнезащита, огнезащитная, огнестойкость, металлоконструкции, м/к, мк, балка, колонна, ферма, r60, r90, r120, r150, eti, плазас, нуллифайр, вспучивающаяся, краска",
        "description": "Огнезащитная обработка стальных конструкций до требуемого предела огнестойкости (R60/R90/R120). Чаще используют вспучивающиеся краски или конструктивную защиту.",
        "stages": [
            {"title": "Подготовка поверхности (очистка + обезжиривание)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.15, "materials_json": '{"solvent_l": 0.05}',
             "gesn_ref": ""},
            {"title": "Антикоррозионный грунт", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.08, "materials_json": '{"primer_kg": 0.25}',
             "gesn_ref": "ГЭСН 13-03-004-01"},
            {"title": "Нанесение огнезащитной краски (база)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.20, "materials_json": '{"fireproof_paint_kg": 1.8}',
             "gesn_ref": "ГЭСНр 64-09-001",
             "notes": "Расход 1.5-2.5 кг/м² зависит от R и формы профиля"},
            {"title": "Промежуточный слой огнезащиты", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.18, "materials_json": '{"fireproof_paint_kg": 1.5}',
             "gesn_ref": "ГЭСНр 64-09-001"},
            {"title": "Финишный декоративный слой", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.10, "materials_json": '{"topcoat_kg": 0.25}',
             "gesn_ref": ""},
            {"title": "Замер толщины сухой плёнки, протокол", "unit": "м²", "norm_per_base_unit": 0.10,
             "labor_hours_per_unit": 0.08, "materials_json": '{}',
             "gesn_ref": "",
             "notes": "Замеры через каждые 2-3м, протокол передаётся в МЧС"},
        ],
    },

    {
        "template_id": "metal_structure_install",
        "title": "Монтаж металлоконструкций",
        "category": "Монтаж м/к",
        "base_unit": "т",
        "typical_volume_min": 5,
        "typical_volume_max": 200,
        "keywords": "монтаж, металлоконструкции, мк, м/к, ферма, балка, колонна, прогон, связи, ригель, кран, такелаж, сварка, болтовое",
        "description": "Сборка и установка металлокаркаса промышленного здания/сооружения. Включает такелаж, сборку на земле, подъём, установку, выверку, сварку/болты.",
        "stages": [
            {"title": "Приёмка металлоконструкций", "unit": "т", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.30, "materials_json": '{}',
             "gesn_ref": "",
             "notes": "Сверка с КМД, паспорта"},
            {"title": "Укрупнительная сборка на земле", "unit": "т", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 8.0, "materials_json": '{"electrode_kg": 6}',
             "gesn_ref": "ГЭСН 09-03-002-01"},
            {"title": "Установка в проектное положение (кран)", "unit": "т", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 4.5, "materials_json": '{}',
             "gesn_ref": "ГЭСНм 09-03-014-01",
             "notes": "Стоимость крана учитывается отдельно"},
            {"title": "Выверка геодезическая", "unit": "т", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.6, "materials_json": '{}',
             "gesn_ref": ""},
            {"title": "Сварка монтажных стыков", "unit": "т", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 6.0, "materials_json": '{"electrode_kg": 8, "gas_m3": 0.5}',
             "gesn_ref": "ГЭСН 09-03-009-01"},
            {"title": "Высокопрочные болтовые соединения", "unit": "т", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 2.0, "materials_json": '{"hp_bolts_kg": 12}',
             "gesn_ref": "ГЭСН 09-03-016-01"},
            {"title": "Контроль качества сварных швов (УЗК)", "unit": "т", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.4, "materials_json": '{}',
             "gesn_ref": "",
             "notes": "10-25% швов в зависимости от категории конструкции"},
        ],
    },

    {
        "template_id": "rope_access_facade_cleaning",
        "title": "Промальп: очистка и покраска фасада",
        "category": "Промальп",
        "base_unit": "м²",
        "typical_volume_min": 300,
        "typical_volume_max": 8000,
        "keywords": "промальп, промышленный, альпинизм, фасад, высотные, верёвки, веревки, очистка, покраска, мойка, граффити, штукатурка, ремонт",
        "description": "Работы методом промышленного альпинизма: очистка, ремонт, окраска, мойка фасадов. Без лесов. Требует допуска ВВР, страховки, СОУТ.",
        "stages": [
            {"title": "Подготовка точек закрепления", "unit": "точка", "norm_per_base_unit": 0.02,
             "labor_hours_per_unit": 1.5, "materials_json": '{"anchor_set": 1}',
             "gesn_ref": ""},
            {"title": "Мойка / очистка фасада водой высокого давления", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.20, "materials_json": '{"detergent_l": 0.05}',
             "gesn_ref": ""},
            {"title": "Шпатлёвка трещин и сколов", "unit": "м²", "norm_per_base_unit": 0.15,
             "labor_hours_per_unit": 0.30, "materials_json": '{"putty_kg": 0.8}',
             "gesn_ref": ""},
            {"title": "Грунтование фасадным грунтом", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.12, "materials_json": '{"facade_primer_l": 0.15}',
             "gesn_ref": ""},
            {"title": "Окраска фасадной краской (2 слоя)", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.25, "materials_json": '{"facade_paint_l": 0.4}',
             "gesn_ref": ""},
            {"title": "Приёмка / фотофиксация", "unit": "м²", "norm_per_base_unit": 1.0,
             "labor_hours_per_unit": 0.02, "materials_json": '{}',
             "gesn_ref": ""},
        ],
    },
]


@frappe.whitelist()
def seed_all(force: int = 0) -> dict:
    """Создаёт 5 базовых Work Template если их ещё нет.

    Если force=1 — перезаписывает существующие.
    """
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Только System Manager может запустить seed")

    created = 0
    skipped = 0
    updated = 0

    for tpl_data in TEMPLATES:
        tid = tpl_data["template_id"]
        exists = frappe.db.exists("Work Template", tid)

        if exists and not int(force or 0):
            skipped += 1
            continue

        if exists:
            frappe.delete_doc("Work Template", tid, force=True, ignore_permissions=True)
            updated += 1

        doc = frappe.get_doc({
            "doctype": "Work Template",
            "template_id": tid,
            "title": tpl_data["title"],
            "category": tpl_data["category"],
            "base_unit": tpl_data["base_unit"],
            "typical_volume_min": tpl_data["typical_volume_min"],
            "typical_volume_max": tpl_data["typical_volume_max"],
            "keywords": tpl_data["keywords"],
            "description": tpl_data["description"],
            "source": "Ручной ввод",
            "is_verified": 1,
            "stages": [
                {**s, "stage_order": idx}
                for idx, s in enumerate(tpl_data["stages"], start=1)
            ],
        })
        doc.insert(ignore_permissions=True)
        if not exists:
            created += 1

    frappe.db.commit()
    return {
        "ok": True,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total": len(TEMPLATES),
    }
