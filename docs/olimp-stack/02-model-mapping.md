# Маппинг моделей данных: OpenConstructionERP → ERPNext

> Этот документ описывает, **какие сущности OCE стоит синхронизировать
> с DocType в ERPNext** и через какие поля делать связь.
> Цель — двусторонняя интеграция через n8n без дублирования данных.

## Принципы маппинга

1. **Master Data** (справочники: материалы, единицы измерения, виды работ)
   → хранятся в ERPNext как **источник истины**, в OCE — реплицируются.
2. **Estimation Data** (BOQ, ресурсы под смету, наценки, графики)
   → хранятся в OCE как **источник истины**, в ERPNext — мирроры для отчётности.
3. **Execution Data** (фактические расходы, акты, табели, склад)
   → хранятся в ERPNext как **источник истины**, в OCE — возвращаются как факт для EVM.
4. **Bridge fields** — у каждого Project в ERPNext есть `custom_oce_boq_id`,
   у каждого BOQ в OCE — `erpnext_project_name`.

---

## Таблица соответствий

### Сущность 1: Project / Проект

| Поле OCE | DocType ERPNext | Поле ERPNext | Направление | Примечания |
|----------|----------------|--------------|-------------|------------|
| `Project.id` (UUID) | `Project` | `custom_oce_project_id` | OCE → ERP | Brigde field |
| `Project.name` | `Project` | `project_name` | OCE → ERP | |
| `Project.client` | `Project` | `customer` | ERP → OCE | Источник — ERPNext |
| `Project.region` | — | — | — | Всегда `RU-URAL` |
| `Project.currency` | `Project` | `currency` | синхр | Всегда `RUB` |
| `Project.start_date` | `Project` | `expected_start_date` | OCE → ERP | Из графика OCE |
| `Project.end_date` | `Project` | `expected_end_date` | OCE → ERP | Из графика OCE |
| `Project.budget_total` | `Project` | `estimated_costing` | OCE → ERP | Сумма BOQ |
| `Project.spi` (EVM) | `Project` | `custom_oce_spi` | ERP ← OCE | Расчётное |
| `Project.cpi` (EVM) | `Project` | `custom_oce_cpi` | ERP ← OCE | Расчётное |
| `Project.eac` (EVM) | `Project` | `custom_oce_eac` | ERP ← OCE | Прогноз |

**Custom Fields для ERPNext Project** (добавить через Customize Form):
```python
{
    "custom_oce_project_id": "Data",
    "custom_oce_boq_id": "Data",
    "custom_oce_boq_version": "Int",
    "custom_oce_spi": "Float",
    "custom_oce_cpi": "Float",
    "custom_oce_eac": "Currency",
    "custom_oce_last_sync": "Datetime",
    "custom_oce_link": "Data",  # URL обратно в OCE
}
```

---

### Сущность 2: BOQ → новый DocType "BOQ"

В ERPNext нет аналога BOQ "из коробки". BOM не подходит — он для производства.
Создаём **новый DocType `BOQ`** как зеркало для отчётности и поиска.

| Поле OCE | DocType ERPNext | Тип поля | Направление |
|----------|----------------|----------|-------------|
| `BOQ.id` | `BOQ` | `name` (PK) | OCE → ERP |
| `BOQ.project_id` | `BOQ` | `project` (Link Project) | OCE → ERP |
| `BOQ.version` | `BOQ` | `version` (Int) | OCE → ERP |
| `BOQ.status` | `BOQ` | `status` (Select: Draft, Submitted, Won, Lost, Archived) | OCE → ERP |
| `BOQ.total_amount` | `BOQ` | `total_amount` (Currency) | OCE → ERP |
| `BOQ.markup_total` | `BOQ` | `markup_total` (Currency) | OCE → ERP |
| `BOQ.vat_amount` | `BOQ` | `vat_amount` (Currency) | OCE → ERP |
| `BOQ.grand_total` | `BOQ` | `grand_total` (Currency) | OCE → ERP |
| `BOQ.created_by` | `BOQ` | `owner` (Link User) | OCE → ERP |
| `BOQ.oce_url` | `BOQ` | `oce_link` (Data) | OCE → ERP |

**Child Table `BOQ Section`:**
```python
{
    "section_code": "Data",       # "1", "1.1", "2.3.4"
    "section_name": "Data",       # "Земляные работы"
    "parent_section": "Link BOQ Section",
    "subtotal": "Currency",
    "order_index": "Int",
}
```

**Child Table `BOQ Position`:**
```python
{
    "position_code": "Data",      # код ГЭСН/ФЕР или внутренний
    "description": "Text",         # "Бетонирование фундаментной плиты С25/30"
    "section": "Link BOQ Section",
    "item": "Link Item",          # связь со справочником материалов!
    "uom": "Link UOM",            # м³, м², т, шт
    "quantity": "Float",
    "unit_rate": "Currency",
    "total": "Currency",          # quantity × unit_rate
    "labor_cost": "Currency",     # из ресурсов
    "material_cost": "Currency",  # из ресурсов
    "equipment_cost": "Currency", # из ресурсов
    "order_index": "Int",
}
```

---

### Сущность 3: Resource → Item Master (расширить)

В OCE Resource = (Material | Labor | Equipment | Operator).
В ERPNext это всё **Item** с разной классификацией.

| Поле OCE | DocType ERPNext | Поле ERPNext | Маппинг |
|----------|----------------|--------------|---------|
| `Resource.id` | `Item` | `item_code` | 1:1 |
| `Resource.name` | `Item` | `item_name` | 1:1 |
| `Resource.type` (M/L/E) | `Item` | `item_group` (Material/Labour/Equipment) | через Item Group |
| `Resource.uom` | `Item` | `stock_uom` | 1:1 |
| `Resource.unit_rate` | `Item Price` | `price_list_rate` | через прайс-лист |
| `Resource.region` | `Item Price` | `price_list` (отдельный для УрФО) | через Price List |

**Item Groups для строительства:**
```
Все материалы
├── Бетон и ЖБИ
├── Металлопрокат и металлоконструкции
├── Антикоррозионные материалы
├── Углеволокно и системы усиления
├── Кровельные материалы
├── Метизы и крепёж
└── Прочие материалы

Трудозатраты
├── ИТР (инженерно-технические)
├── Рабочие квалифицированные
├── Рабочие неквалифицированные
├── Промальп
└── Сварщики

Оборудование и техника
├── Грузоподъёмная техника
├── Сварочное оборудование
├── АКЗ-оборудование
└── Прочая техника
```

---

### Сущность 4: Assembly → новый DocType "Construction Assembly"

OCE Assembly = переиспользуемый рецепт "столько ресурсов на единицу работы".
В ERPNext есть BOM, но он привязан к Item и заточен под производство.
Создаём отдельный `Construction Assembly`.

```python
DocType "Construction Assembly":
{
    "assembly_code": "Data",          # "AKZ-G3-M2"
    "assembly_name": "Data",          # "АКЗ группа 3, 2 слоя, м²"
    "category": "Link Item Group",    # категория работ
    "uom": "Link UOM",                # на 1 м², т, шт
    "labor_hours": "Float",           # нормативные чел-часы
    "items": "Table 'Assembly Item'", # child table с ресурсами
    "base_rate": "Currency",          # расчётная себестоимость
    "market_rate": "Currency",        # рыночная цена УрФО
    "margin_percent": "Percent",      # маржа
}

Child Table "Assembly Item":
{
    "item": "Link Item",
    "qty_per_uom": "Float",           # сколько единиц ресурса на 1 UOM сборки
    "uom": "Link UOM",
    "rate": "Currency",               # подгружается из Item Price
    "amount": "Currency",             # qty × rate
}
```

**Типовые сборки для Олимпа** (создать сразу при внедрении):
- АКЗ группы 3 на 1 м² (грунт + 2 слоя эмали)
- АКЗ группы 5 на 1 м² (грунт + 3 слоя для агрессивной среды)
- Усиление углеволокном на 1 м² (1 слой)
- Монтаж металлоконструкций на 1 т
- Кровля наплавляемая на 1 м² (2 слоя)
- Промальп: высотные работы на 1 чел-смену
- Бетон В25 в опалубке на 1 м³
- Огнезащита R90 на 1 м² МК

---

### Сущность 5: Markup → Tax Template (переиспользовать)

OCE Markup = (Overhead | Profit | VAT | Contingency).
ERPNext: `Sales Taxes and Charges Template` подходит для VAT и накладных, а
для overhead и profit лучше отдельные `additional_discount_percentage` поля.

| OCE Markup Type | ERPNext решение |
|-----------------|-----------------|
| VAT 20% | Standard Sales Tax Template "НДС 20%" |
| Overhead (накладные) | Custom field в Project: `custom_overhead_percent` |
| Profit (плановая прибыль) | Custom field в Project: `custom_target_margin_percent` |
| Contingency (резерв) | Custom field в Project: `custom_contingency_percent` |

---

### Сущность 6: Schedule Activity → Task (расширить)

ERPNext Task уже умеет иерархию и сроки. Не хватает:
- Зависимостей FS/FF/SS/SF (только FS из коробки, через `depends_on_tasks`)
- Lag time (задержка между задачами)
- Auto-расчёта critical path

**Custom Fields для Task:**
```python
{
    "custom_oce_activity_id": "Data",
    "custom_dependency_type": "Select: FS, FF, SS, SF",
    "custom_lag_days": "Int",
    "custom_is_critical_path": "Check",
    "custom_baseline_start": "Date",
    "custom_baseline_end": "Date",
    "custom_actual_progress_percent": "Percent",
    "custom_earned_value": "Currency",
}
```

Расчёт critical path делает OCE, в ERPNext только мирроринг для отчётов.

---

### Сущность 7: Tender → Quotation + Supplier Quotation

OCE Tender = пакет для рассылки субподрядчикам.
ERPNext: создаётся `Request for Quotation` (RFQ) c набором поставщиков,
каждый присылает `Supplier Quotation`.

| OCE | ERPNext |
|-----|---------|
| `Tender` | `Request for Quotation` |
| `Tender.scope` | RFQ Items (из BOQ Sections) |
| `Tender.suppliers` | RFQ Suppliers |
| `Tender Bid` | `Supplier Quotation` |
| `Tender Bid.comparison` | Custom Report `Tender Comparison` |

**Workflow:**
```
OCE: создаётся Tender для секции "Огнезащита"
n8n: вытаскивает позиции BOQ из секции
n8n: создаёт RFQ в ERPNext, добавляет 5 поставщиков-субов
ERPNext: рассылает email с портальной ссылкой
Субы заполняют Supplier Portal → Supplier Quotation
n8n: вытаскивает все Supplier Quotation, отправляет в OCE
OCE: показывает side-by-side сравнение, выделяет минимум
Дима выбирает → выбранный Supplier Quotation → Purchase Order
```

---

### Сущность 8: Change Order → новый DocType "Project Change Order"

Допсоглашения с заказчиком.

```python
DocType "Project Change Order":
{
    "project": "Link Project",
    "boq": "Link BOQ",
    "change_number": "Data",          # "ДС-1", "ДС-2"
    "date_initiated": "Date",
    "reason": "Text",                  # "Заказчик добавил усиление колонн"
    "scope_change": "Text",
    "cost_impact": "Currency",         # +/- к смете
    "schedule_impact_days": "Int",     # +/- к графику
    "status": "Select: Draft, Submitted, Approved, Rejected",
    "approved_by_client_date": "Date",
    "doc_link_minio": "Data",          # PDF допсоглашения в MinIO
    "affected_positions": "Table",     # какие позиции BOQ затронуты
}
```

---

### Сущность 9: Risk → новый DocType "Project Risk"

```python
DocType "Project Risk":
{
    "project": "Link Project",
    "risk_name": "Data",                # "Скрытые конструкции в фундаменте"
    "category": "Select",                # Технический/Погодный/Логистика/Заказчик/Субподрядчик
    "probability": "Select: Low, Medium, High",
    "impact_cost": "Currency",
    "impact_days": "Int",
    "mitigation": "Text",
    "owner": "Link User",
    "status": "Select: Open, Realized, Closed",
    "monte_carlo_p80": "Currency",      # 80-й перцентиль из симуляции
}
```

---

### Сущность 10: Quantity Takeoff → нет аналога в ERPNext

Обмеры с чертежей. Хранятся **только в OCE**, в ERPNext не реплицируем —
итог попадает в BOQ Position.quantity, источник — атрибут.

---

## Summary: сколько новых DocType добавляется в ERPNext

| Новый DocType | Назначение | Приоритет |
|---------------|------------|-----------|
| `BOQ` | Зеркало сметы для отчётности | P0 |
| `BOQ Section` (Child) | Иерархия секций | P0 |
| `BOQ Position` (Child) | Позиции сметы | P0 |
| `Construction Assembly` | Типовые сборки работ | P1 |
| `Assembly Item` (Child) | Состав сборки | P1 |
| `Project Change Order` | Допсоглашения | P1 |
| `Project Risk` | Реестр рисков | P2 |
| `Tender Comparison Report` | Отчёт по тендерам | P2 |

**Расширения существующих DocType** (через Customize Form):
- `Project` — 8 custom fields
- `Task` — 7 custom fields
- `Item` — Item Groups для стройки

---

## Поле-мост: индексация связей

В каждом синхронизируемом DocType добавляется:
```python
{
    "oce_id": "Data",           # UUID в OCE
    "oce_last_sync": "Datetime",  # последняя синхронизация
    "oce_sync_status": "Select: Pending, Synced, Conflict, Error",
}
```

Это позволяет n8n быстро находить, что нужно синхронизировать, и ловить конфликты при двунаправленных правках.

---

## Что НЕ синхронизируем

| Сущность | Почему не синхр |
|----------|-----------------|
| OCE `Validation Rule` | Логика валидации живёт только в OCE |
| OCE `Cost Database` | Расценки только в Item Price ERPNext |
| OCE `User`, `Role` | Аутентификация — отдельно у каждой системы (SSO планируется в v2) |
| OCE `Notification` | Только Telegram через n8n |
| ERPNext `Sales Order`, `Sales Invoice` | Финансы — только в ERPNext |
| ERPNext `Stock Ledger` | Склад — только в ERPNext |
| ERPNext `Salary Slip` | HR — только в ERPNext |
