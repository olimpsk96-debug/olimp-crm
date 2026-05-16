# OLIMP.STACK — статус интеграции с OpenConstructionERP

> Документ описывает что из плана `olimp-stack/updete.zip` **уже внедрено**
> в текущий olimp-erp (v6.3), а что — **отложено** до решения о подъёме OCE.

## Контекст

В архиве `updete.zip` приходил полный план интеграции OpenConstructionERP (OCE):
отдельный AGPL-сервис для смет/BOQ/AI Cost Advisor, который связывается с ERPNext
через n8n. План — 6 недель работы, требует +4 ГБ RAM, OpenAI ключи, DNS
`estimate.olimp-ural.ru`, отдельный Postgres-контейнер.

**Решение:** реализован «мини-план» — DocType + Custom Fields + n8n workflows
в репозитории. **OCE как отдельный сервис не поднимается** (отложено в backlog).
Это даёт BOQ-функциональность внутри olimp-erp без AGPL/инфра-нагрузки.

---

## Что внедрено (v6.3) ✅

### 1. Новые DocType (5 штук)

| DocType | Файл | Назначение |
|---------|------|------------|
| `BOQ` | `backend/.../doctype/boq/boq.json` | Главная сущность сметы (BOQ-2026-00001) |
| `BOQ Section` | `.../doctype/boq_section/` | Child Table: разделы сметы |
| `BOQ Position` | `.../doctype/boq_position/` | Child Table: позиции |
| `Construction Assembly` | `.../doctype/construction_assembly/` | Типовые сборки работ (АКЗ, огнезащита, бетон) |
| `Assembly Item` | `.../doctype/assembly_item/` | Child: ресурсы внутри сборки |

Все 5 имеют поле `oce_*_id` для будущей синхронизации, если соберём OCE.

### 2. Custom Fields (31 поле к 4 существующим DocType)

| DocType | Полей | Что добавлено |
|---------|-------|---------------|
| `Construction Project` | 9 | OCE Section: `oce_project_id`, `oce_boq_id`, `oce_boq_version`, `oce_spi`, `oce_cpi`, `oce_eac`, `oce_last_sync` |
| `Task` | 9 | OCE Section: `oce_activity_id`, `dependency_type` (FS/FF/SS/SF), `lag_days`, `is_critical_path`, `baseline_start/end`, `earned_value` |
| `Project Risk` | 10 | Monte Carlo: `probability_value` (%), `impact_cost_min/max`, `impact_days_min/likely/max`, `monte_carlo_p80`, `oce_risk_id` |
| `Change Order` | 3 | OCE: `doc_link_minio` (URL ДС), `oce_change_order_id` |

Скрипт повторной установки: `backend/olimp_construction/olimp_construction/install_oce.py::sync_oce_fields()`.

### 3. Item Groups для строительства (13 групп)

Корневая: «Строительство (ОЛИМП)», дочерние:
- Бетон и ЖБИ · Металлопрокат и МК · АКЗ материалы · Углеволокно · Кровельные · Метизы
- ИТР · Рабочие квалифицированные · Промальп · Сварщики
- Грузоподъёмная техника · Сварочное оборудование · АКЗ-оборудование

### 4. n8n workflows (в репо, не активированы)

`n8n/workflows/oce/`:
- `01-boq-to-erpnext-project.json` — Webhook BOQ Won → создать Project + Tasks
- `02-actuals-to-evm.json` — Cron 23:00 ночью: факт расходов → EVM в OCE

Импортировать когда поднимется OCE.

### 5. Документация (в репо)

`docs/olimp-stack/`:
- `README.md` — обзор стека
- `01-architecture.md` — целевая архитектура слоёв
- `02-model-mapping.md` — маппинг OCE-сущностей на ERPNext DocType
- `03-agpl-risks.md` — юридический разбор AGPL-3.0
- `04-boq-example-ntmk.md` — пример BOQ на реальном объекте НТМК
- `05-implementation-roadmap.md` — план внедрения по неделям

### 6. Deploy-конфиги для будущего OCE (в репо, не активированы)

`deploy/oce/`:
- `docker-compose.olimp.yml` — compose-надстройка для OCE
- `.env.olimp.example` — шаблон переменных
- `Caddyfile.oce` — TLS для estimate.olimp-ural.ru
- `oce-postgres-init.sql` — инициализация Postgres
- `import-doctypes.sh` — bash-импорт DocType (для чистой установки)

---

## Что отложено (backlog)

### Подъём OpenConstructionERP как отдельного сервиса

Не активировано до явного решения. Что нужно для запуска:
1. Подтвердить +4 ГБ RAM на VPS (текущие 4 ГБ уже заняты ERPNext+n8n+minio)
2. DNS `estimate.olimp-ural.ru` → IP сервера
3. OpenAI API ключ (для embeddings text-embedding-3-large; ~$10/мес на 5K позиций)
4. Принять AGPL-3.0 для внутреннего использования (см. `03-agpl-risks.md`)
5. Создать сеть `olimp_network` как external (если ещё не)
6. `docker compose -f docker-compose.yml -f deploy/oce/docker-compose.olimp.yml up -d`
7. Импортировать 2 n8n workflows, настроить ERPNext API-токен в credentials

См. `05-implementation-roadmap.md` для полного 6-недельного плана.

### Альтернатива: BOQ-функции внутри olimp-erp

Без OCE можно строить smart estimate UX напрямую на новых DocType:
- AI Cost Advisor через Claude/Anthropic API уже подключён (см. v3.5+)
- Semantic search через Qdrant (см. v3.3)
- RevoGrid Excel-like редактор смет (v6.2)
- TipTap-конструктор КП с подписью клиента (v6.0-6.1)

Эти инструменты дают ~70% функциональности OCE без AGPL-инфры.

---

## Использование новых DocType

### Создать первую BOQ через UI

```
1. Открыть https://erp.olimp-ural.ru/app/boq
2. Кнопка «New» → форма BOQ
3. Выбрать Construction Project + Customer
4. Добавить секции (Раздел 1. Подготовительные, Раздел 2. Армирование)
5. Добавить позиции с привязкой к Construction Assembly
6. Накладные/прибыль/резерв — посчитаются автоматом (на доработку формул)
```

### Создать типовую Assembly

```
1. Открыть https://erp.olimp-ural.ru/app/construction-assembly
2. Кнопка «New» → код AKZ-G3-M2, название «АКЗ группа 3, 2 слоя, м²»
3. Категория: АКЗ / Огнезащита, ед: м²
4. Добавить Items: грунт ВЛ-02 (0.18 кг/м²), эмаль ХС-720 (0.35 кг/м²),
   рабочий АКЗ (0.4 чел-час/м²)
5. base_rate посчитается автоматом (после фикса формул)
```

### Расширения существующих DocType

В `Construction Project` теперь есть секция «OCE Integration» (collapsible).
В `Task` — секция «OCE Integration» с зависимостями FS/FF/SS/SF.
В `Project Risk` — секция «OCE / Monte Carlo» для прогнозирования.

---

## Связь с другими модулями olimp-erp

| Модуль | Связь с BOQ |
|--------|-------------|
| `Estimate` (наша смета) | `BOQ.estimate_link` — можно создать BOQ из существующей сметы |
| `Construction Project` | `BOQ.project` + `Project.oce_boq_id` (двусторонняя) |
| `Catalog Resource` (CWICR) | `BOQ Position.catalog_resource`, `Assembly Item.catalog_resource` |
| `Change Order` | `Project Change Order.boq` (link на BOQ) |
| `Project Risk` | Monte Carlo поля для прогнозирования |
| `Construction Proposal` (КП) | `BOQ` → можно генерировать КП из выигранной BOQ |
