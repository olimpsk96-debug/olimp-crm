# SCHEMA_v5.md — Схема данных (с AI и техникой)

**ERPNext v15 + кастомное приложение `olimp_construction`**
**Версия 5.0** — после критической фильтрации ТЗ v2 (взяли 5 полезных элементов)

---

## 0. Что изменилось vs v4

### Добавлены 5 элементов из ТЗ v2

- 🆕 **Блок F: AI-ассистент с RAG** (Knowledge Base + Embeddings + Conversations) — 4 DocType
- 🆕 **Блок G: AI Cashflow прогноз** (Customer Payment Pattern + Forecast Snapshot) — 2 DocType
- 🆕 **Блок H: Управление техникой** (Equipment + Maintenance Log + Fuel Log) — 3 DocType
- 🆕 **Блок I: Голосовой ввод** (Voice Note) — 1 DocType, расширение Foreman Report
- 🆕 **Блок J: AI Recommendation Engine** (Recommendation + Pattern Library) — 2 DocType

### Итого DocType: 34 → **46** (+12)

### Что НЕ берём из ТЗ v2 (сознательно)

- ❌ BIM/ТИМ просмотрщик (3D, IFC, Revit) — нет заказчиков с моделями
- ❌ Цифровой двойник
- ❌ IoT датчики (LoRaWAN, Zigbee)
- ❌ Компьютерное зрение (Buildots-style)
- ❌ Дроны как платформа (используем как процесс)
- ❌ AR на мобильном
- ❌ Биометрия / Face ID
- ❌ RFI / Submittals / Change Orders (избыточно для рынка «Олимпа»)
- ❌ Портфельное управление (когда будет 20+ проектов — добавим)
- ❌ Клиентский портал (Фаза 9+, когда заказчики потребуют)

---

## 1. Принципы (без изменений vs v4)

1. Не дублируем стандартные ERPNext — расширяем через Custom Fields
2. Каждый кастомный DocType имеет workflow
3. Связи через Link / Dynamic Link
4. Деньги — Currency (precision 2), никогда float
5. Все суммы — в рублях
6. Аудит: created_by, modified_by, creation, modified — стандарт Frappe
7. **🆕 AI-данные хранятся отдельно** — не загрязняют основные DocType

---

## 2. Карта DocType (46 сущностей)

### 🔴 Фаза 1-6 (как в v4) — 34 DocType
Всё что было в v4: Tender, Project, Estimate, Material Request, Stock, KS2, Schedule, Foreman Report, etc.

### 🆕 Фаза 7 — AI-ассистент (4 DocType)
- 🆕 `AI Knowledge Document` — документ в базе знаний
- 🆕 `AI Knowledge Chunk` (child) — фрагмент для эмбеддинга
- 🆕 `AI Conversation` — диалог пользователя с ассистентом
- 🆕 `AI Conversation Message` (child) — сообщение в диалоге

### 🆕 Фаза 7 — AI Cashflow (2 DocType)
- 🆕 `Customer Payment Pattern` — статистика по заказчику
- 🆕 `Cashflow Forecast Snapshot` — снимок прогноза на дату

### 🆕 Фаза 7 — AI Recommendations (2 DocType)
- 🆕 `AI Recommendation` — конкретная рекомендация для директора
- 🆕 `AI Pattern` — выявленный паттерн в данных

### 🆕 Фаза 8 — Техника (3 DocType)
- 🆕 `Equipment` — единица техники
- 🆕 `Maintenance Log` — журнал ТО и ремонтов
- 🆕 `Fuel Log` — журнал ГСМ и моточасов

### 🆕 Фаза 6 (расширение) — Голос (1 DocType)
- 🆕 `Voice Note` — голосовая заметка (от прораба или директора)
- расширение `Foreman Report` — поле voice_note_link

---

## 3. БЛОК A · Тендеры (Фаза 1)

### 3.A.1 Tender ⭐

```yaml
DocType: Tender
naming: "TND-{YYYY}-{####}"   # TND-2026-0001
title_field: title
module: Olimp Construction

fields:
  # ── Основное ──────────────────────────────────────────────────────
  - title: Data, required              # Название тендера
  - status: Select, required [
      "Новый",                         # только найден, не рассмотрен
      "Оценивается",                   # идёт анализ / запрошены данные
      "Готовится заявка",              # команда готовит КП
      "Заявка подана",                 # подано, ждём итогов
      "Выиграли",                      # контракт наш
      "Проиграли",                     # проигран
      "Отклонён"                       # решили не подавать
    ]
  - customer: Link → Customer          # Заказчик

  # ── Параметры закупки ─────────────────────────────────────────────
  - tender_law: Select [
      "44-ФЗ",                         # госзакупки (Госзакупки.ру / ЕИС)
      "223-ФЗ",                        # закупки госкомпаний
      "Коммерческий"                   # частный заказчик
    ]
  - purchase_number: Data              # Номер закупки (ИКЗ / реестровый №)
  - platform_url: Data                 # Ссылка на лот на площадке
  - work_type: Select [
      "АКЗ",                           # антикоррозийная защита
      "Кровля",
      "Промальп",
      "Монолит",
      "Усиление",
      "Комплексный"
    ]
  - region: Data                       # Регион объекта

  # ── Финансы ───────────────────────────────────────────────────────
  - nmck: Currency                     # НМЦК (начальная максимальная цена)
  - our_price: Currency                # Наша цена предложения
  - margin_pct: Percent                # Целевая маржа, %

  # ── Сроки ─────────────────────────────────────────────────────────
  - deadline_date: Date, required      # Дедлайн подачи заявки
  - deadline_time: Time                # Время дедлайна (МСК)
  - submission_date: Date              # Дата фактической подачи

  # ── AI-анализ ─────────────────────────────────────────────────────
  - ai_match_score: Int                # 0-100, % соответствия профилю компании
  - ai_recommendation: Select [
      "Подать",
      "Не подавать",
      "Проверить вручную"
    ]
  - ai_analysis: Long Text             # Развёрнутый анализ Claude

  # ── Итог ──────────────────────────────────────────────────────────
  - result: Select [
      "Выиграли",
      "Проиграли",
      "Отменён заказчиком"
    ]
  - win_amount: Currency               # Сумма контракта (если выиграли)
  - project_link: Link → Project       # Связанный проект (после победы)

  # ── Прочее ────────────────────────────────────────────────────────
  - notes: Text Editor                 # Внутренние комментарии
  - checklist: Table                   # Чеклист документов для подачи
  - amended_from: Link → Tender        # Если создан через Amend

permissions:
  - role: "Tender Manager"  → read, write, create
  - role: "Director"        → read, write, create, delete, submit
  - role: "All"             → read (только свои)

workflow:
  # States совпадают с полем status
  Новый → Оценивается → Готовится заявка → Заявка подана
                                                          ↓           ↓
                                                      Выиграли   Проиграли
  Любой → Отклонён

api_endpoints:
  - olimp_construction.api.tender.get_pipeline   # GET all for Kanban
  - olimp_construction.api.tender.score_tender   # POST → AI-оценка (Фаза 1.4)
```

### Бизнес-правила

- **Алерты** (cron daily): за 7/3/1 день до `deadline_date` → Telegram директору
- **AI-оценка**: при создании (или по кнопке) Claude анализирует title + work_type + region + nmck → ставит `ai_match_score` и `ai_recommendation`
- **После победы**: автоматически создаётся Project, поле `project_link` заполняется
- **Конверсия**: `Выиграли / (Выиграли + Проиграли)` — показывается на дашборде директора

### Связи с другими DocType

```
Tender → Customer           (заказчик)
Tender → Project            (после победы)
Tender → AI Knowledge Document  (индексируется с итогом)
```

---

## 3. БЛОК B · Сметы (Фаза 2)

### 3.B.1 Estimate ⭐

```yaml
DocType: Estimate
naming: "EST-{YYYY}-{#####}"   # EST-2026-00001
title_field: title
module: Olimp Construction

fields:
  # ── Основное ──────────────────────────────────────────────────────
  - title: Data, required              # "Смета АКЗ Marins Park v2"
  - status: Select, required [
      "Базовая",                       # первая версия, не утверждена
      "Скорректированная",             # скорректирована после замечаний
      "Утверждена",                    # утверждена и принята к работе
      "Архив"                          # устаревшая версия
    ]
  - version: Int, default=1           # версия сметы

  # ── Привязки ─────────────────────────────────────────────────────
  - project: Link → Project
  - tender: Link → Tender
  - estimate_date: Date

  # ── Позиции ──────────────────────────────────────────────────────
  - items: Table → Estimate Item (child)

  # ── Итоги (авто) ────────────────────────────────────────────────
  - base_total: Currency, read_only   # сумма по нормам (с накладными + прибылью)
  - our_total: Currency, read_only    # наша цена итого
  - overhead_pct: Percent             # накладные расходы, %
  - profit_pct: Percent               # сметная прибыль, %
  - margin_pct: Percent, read_only    # маржа = (наша - норм) / наша
  - margin_amount: Currency, read_only

  # ── Импорт ──────────────────────────────────────────────────────
  - import_source: Select ["Гранд-Смета GS3", "Гранд-Смета XML", "Ручной ввод"]
  - imported_at: Datetime, read_only
  - notes: Text Editor

business_logic:
  - before_save: рассчитывает base_amount/our_amount каждой позиции, затем base_total/our_total/margin_pct
  - deviation_pct: (our - base) / base × 100 на каждой позиции
  - import_from_gs_xml: парсит XML Гранд-Сметы, создаёт позиции автоматически

permissions:
  - All: read, write, create
  - System Manager: delete
```

### 3.B.2 Estimate Item (child) ⭐

```yaml
DocType: Estimate Item
istable: 1
module: Olimp Construction

fields:
  - is_section: Check              # 1 = строка-раздел (группировка)
  - item_code: Data                # код по расценке (ГЭСН, ТЕР, ФЕР)
  - item_name: Data, required      # наименование работ / раздел
  - unit: Data                     # ед. измерения (м², м³, т, шт)
  - qty: Float, precision=3        # количество
  - base_unit_price: Currency      # единичная цена по норме
  - base_amount: Currency, r/o     # qty × base_unit_price
  - our_unit_price: Currency       # наша единичная цена
  - our_amount: Currency, r/o      # qty × our_unit_price
  - deviation_pct: Percent, r/o    # отклонение нашей цены от нормы, %
  - work_type: Select [АКЗ, Кровля, Промальп, Монолит, Усиление, Комплексный]
  - notes: Small Text
```

### Связи Estimate

```
Estimate → Project  (один проект — несколько версий смет)
Estimate → Tender   (смета для конкретного тендера)
```

---

## 3. БЛОК F · AI-ассистент с RAG (новое)

### 3.F.1 AI Knowledge Document ⭐

```yaml
DocType: AI Knowledge Document
naming: "AKD-{####}"
title_field: document_title

fields:
  # Идентификация
  - document_title: Data, required        # "Смета по объекту Marins Park v2"
  - source_doctype: Link → DocType         # из какого DocType пришёл
  - source_name: Data                      # ID конкретной записи

  # Источник
  - source_type: Select [
      "Estimate",           # сметы
      "KS2 Act",           # подписанные КС-2
      "Sales Order",       # договоры
      "Purchase Order",    # заказы поставщикам
      "Tender",            # выигранные/проигранные тендеры
      "Project",           # карточки проектов
      "Foreman Report",    # отчёты прорабов
      "Manual Upload",     # ручная загрузка
      "External File"      # внешний файл (PDF, DOCX)
    ]

  # Содержание
  - raw_content: Long Text                 # исходный текст
  - structured_content: JSON               # структурированные данные
  - file_attachment: Attach                # если из файла

  # Метаданные
  - project: Link → Project                # к какому проекту относится
  - customer: Link → Customer
  - tags: Table → Document Tag             # теги для фильтра
  - language: Select [Russian, English] (default: Russian)

  # AI индексация
  - is_indexed: Check                      # эмбеддинги созданы
  - last_indexed_at: Datetime
  - chunks: Table → AI Knowledge Chunk
  - embedding_model: Data                  # "text-embedding-3-large"

  # Контроль доступа (важно!)
  - access_level: Select [
      "Public",            # все пользователи
      "Internal",          # только сотрудники
      "Confidential",      # только директор + ПТО
      "Director Only"      # только директор
    ] default: Internal

  # Workflow
  - status: Select [Draft, Indexing, Active, Archived]
  - archive_reason: Small Text

automatic_actions:
  - При создании Estimate (статус "Базовая") → создать AI Knowledge Document
  - При подписании KS2 Act → создать AI Knowledge Document
  - При завершении Project → создать AI Knowledge Document с резюме
  - Cron daily: переиндексация изменённых документов
```

### 3.F.2 AI Knowledge Chunk (child)

```yaml
DocType: AI Knowledge Chunk (child of AI Knowledge Document)
fields:
  - chunk_no: Int                          # порядковый
  - chunk_text: Long Text                  # фрагмент 500-1500 токенов
  - chunk_context: Small Text              # контекст (заголовок раздела)
  - embedding: Long Text                   # JSON-массив 1536/3072 dim
  - token_count: Int

  # Для retrieval
  - relevance_keywords: Data               # ключевые слова для гибридного поиска

# Стратегия chunking:
# - Estimate: 1 chunk = 1 раздел сметы
# - KS2 Act: 1 chunk = 1 этап
# - Project: 1 chunk = карточка целиком (если короткая) или по табам
# - Tender: 1 chunk = весь тендер с решением
# - Manual Upload: автоматический split по ~1000 токенов с перекрытием 100
```

### 3.F.3 AI Conversation ⭐

```yaml
DocType: AI Conversation
naming: "AIC-{YYYY}-{MM}-{####}"
fields:
  - user: Link → User, required
  - title: Data                            # "Анализ маржи по АКЗ за 2025"
  - started_at: Datetime
  - last_message_at: Datetime

  # Контекст
  - context_project: Link → Project        # если разговор про конкретный проект
  - context_filters: JSON                  # дополнительные фильтры

  # Содержание
  - messages: Table → AI Conversation Message

  # Использование
  - total_tokens_used: Int
  - total_cost_rub: Currency               # для контроля бюджета на AI
  - llm_model: Data                        # "claude-opus-4-7" / "gpt-4o"

  # Состояние
  - status: Select [Active, Archived]
  - is_pinned: Check                       # закрепить важный диалог

# Лимиты:
# - 1 conversation = до 50 сообщений
# - дальше — новый conversation с переносом контекста
```

### 3.F.4 AI Conversation Message (child)

```yaml
DocType: AI Conversation Message (child of AI Conversation)
fields:
  - message_no: Int
  - role: Select [User, Assistant, System]
  - content: Long Text                     # текст сообщения
  - voice_note: Link → Voice Note          # если был голосовой ввод

  # RAG метаданные
  - retrieved_chunks: Table → Retrieved Chunk  # какие фрагменты использовались
  - search_query: Data                     # перевёрнутый поисковый запрос
  - tokens_used: Int

  # Действия
  - suggested_actions: JSON                # массив [{action, label, params}]
  - actions_taken: JSON                    # что пользователь сделал

  - created_at: Datetime
```

---

## 4. БЛОК G · AI Cashflow прогноз (новое)

### 4.G.1 Customer Payment Pattern ⭐

```yaml
DocType: Customer Payment Pattern
naming: "CPP-{customer}"
fields:
  - customer: Link → Customer, unique

  # Статистика по платежам (расчёт автоматически)
  - total_invoices_count: Int              # всего КС-3 / счетов
  - paid_invoices_count: Int
  - average_payment_days: Float            # среднее время оплаты
  - median_payment_days: Float             # медиана (более устойчиво)
  - std_dev_payment_days: Float            # разброс

  # Сегментация
  - rating: Select [A, B, C, D]
  # A — медиана < 14 дней, разброс < 5
  # B — медиана 14-30 дней, разброс < 10
  # C — медиана 30-45 дней
  # D — медиана > 45 дней или были просрочки > 90 дней

  - on_time_pct: Percent                   # доля оплат вовремя
  - delayed_pct: Percent                   # доля просрочек > 14 дней
  - heavy_delayed_pct: Percent             # доля просрочек > 60 дней

  # Тренд (последние 6 месяцев vs предыдущие)
  - trend: Select [Improving, Stable, Worsening]
  - trend_delta_days: Float                # на сколько изменилась медиана

  # Сезонность
  - seasonal_pattern: JSON                 # "декабрь — задержка +15 дней"

  # Прогноз для будущих оплат
  - next_payment_eta_days: Int             # ожидаемое время следующей оплаты
  - confidence_pct: Percent                # уверенность в прогнозе

  - last_calculated: Datetime
  - history: Table → Payment History Item

cron_job:
  # Раз в неделю пересчитываем для всех заказчиков
  - schedule: weekly (Monday 03:00)
  - update_all_patterns()
```

### 4.G.2 Cashflow Forecast Snapshot

```yaml
DocType: Cashflow Forecast Snapshot
naming: "CFS-{YYYY-MM-DD}"

# Каждый день в 06:00 создаётся новый снимок прогноза
# Чтобы можно было сравнить: «вчера прогнозировали +3,5 млн, а сегодня +3,2 млн»

fields:
  - snapshot_date: Date, required, unique

  # Итоговые цифры
  - current_balance: Currency              # текущий остаток
  - forecast_30d_incoming: Currency        # прогноз поступлений 30 дней
  - forecast_30d_outgoing: Currency        # прогноз платежей 30 дней
  - forecast_30d_net: Currency             # сальдо
  - forecast_30d_min_balance: Currency     # минимум кассы (важно!)
  - forecast_30d_min_date: Date            # когда минимум

  # Риски
  - is_cash_gap_predicted: Check           # будет разрыв?
  - cash_gap_amount: Currency
  - cash_gap_date: Date

  # Расшифровка
  - daily_forecast: JSON                   # [{date, incoming, outgoing, balance}]
  - top_incoming: JSON                     # топ-5 ожидаемых поступлений
  - top_outgoing: JSON                     # топ-5 предстоящих платежей

  # AI-инсайты
  - ai_insights: Long Text                 # автогенерация: "Что нужно сделать"
  - confidence_score: Percent              # уверенность модели

  # Метаданные модели
  - model_version: Data                    # "v1.2"
  - input_features_count: Int              # сколько факторов учли
```

---

## 5. БЛОК J · AI Recommendation Engine (новое)

### 5.J.1 AI Recommendation ⭐

```yaml
DocType: AI Recommendation
naming: "AIR-{YYYY}-{MM}-{####}"

# Это рекомендации, которые показываются на дашборде директора
# (как AI-инсайты, которые мы рисовали в прототипах)

fields:
  # Тип рекомендации
  - recommendation_type: Select [
      "Close KS2",                # «закрой КС-2 этап X»
      "Pursue Tender",            # «подай этот тендер»
      "Reject Tender",            # «не подавай — низкий шанс»
      "Adjust Estimate Price",    # «подними цену на X% — есть запас»
      "Replace Material",         # «замени материал — дешевле аналог»
      "Pay Subcontractor",        # «оплати субу — задерживается»
      "Renew Safety Cert",        # «продли допуск работника»
      "Investigate Overspend",    # «проверь перерасход»
      "Customer Followup",        # «напомни заказчику об оплате»
      "Equipment Maintenance",    # «техника требует ТО»
      "Other"
    ]

  # Контекст
  - target_doctype: Link → DocType         # к чему относится
  - target_name: Data                      # ID записи
  - target_link: Data                      # ссылка для перехода

  # Содержание
  - title: Data, required                  # «Закрой КС-2 №3 на Marins Park»
  - explanation: Long Text                 # подробное объяснение причины
  - estimated_value_rub: Currency          # денежный эффект, если действовать
  - urgency: Select [Critical, High, Medium, Low]

  # Действие
  - suggested_action: Data                 # «Создать КС-2 на этап 3»
  - action_endpoint: Data                  # API endpoint для one-click

  # Адресат
  - target_user: Link → User
  - target_role: Link → Role

  # Жизненный цикл
  - status: Select [
      Active,            # показывается
      Acknowledged,      # увидел, но не сделал
      Acted,             # сделал
      Dismissed,         # отклонил
      Expired            # устарела
    ]

  - shown_at: Datetime                     # когда впервые показано
  - acted_at: Datetime
  - dismissed_at: Datetime
  - dismissal_reason: Small Text

  # Источник
  - source_pattern: Link → AI Pattern      # из какого паттерна
  - confidence_pct: Percent                # уверенность AI
  - model_used: Data                       # какая модель сгенерила
```

### 5.J.2 AI Pattern (библиотека правил)

```yaml
DocType: AI Pattern
naming: "PAT-{####}"

# Это «правила» (rules), которые порождают рекомендации
# Часть жёстко закодированы (best practices),
# часть — обучаются на фидбэке директора

fields:
  - pattern_name: Data, required
  - description: Text Editor

  # Категория
  - category: Select [
      Cashflow,
      KS2,
      Tender,
      Estimate,
      Subcontract,
      Safety,
      Equipment
    ]

  # Логика
  - trigger_type: Select [Rule-based, ML-based]

  - rule_definition: JSON                  # для rule-based:
  # {
  #   "condition": "ks2.status == 'Готов' AND days_since_ready > 5",
  #   "action": "create_recommendation",
  #   "params": {...}
  # }

  - ml_model_endpoint: Data                # для ML-based

  # Параметры
  - is_active: Check (default: True)
  - priority: Int                          # порядок выполнения

  # Эффективность
  - times_triggered: Int
  - times_acted_on: Int
  - effectiveness_pct: Percent             # acted / triggered

  # Обратная связь
  - last_feedback: Datetime
  - feedback_score: Float                  # средняя оценка от директора
```

**Стартовый набор паттернов (15 правил):**

```python
PATTERNS = [
    # Cashflow
    {"name": "KS2 готов > 5 дней — закрывай", "category": "KS2"},
    {"name": "Дебиторка > 30 дней — напомни", "category": "Cashflow"},
    {"name": "Прогноз разрыва за 14 дней — алерт", "category": "Cashflow"},

    # Тендеры
    {"name": "Match score > 80% — подай", "category": "Tender"},
    {"name": "Match score < 40% — не подавай", "category": "Tender"},
    {"name": "Дедлайн < 24ч — срочный алерт", "category": "Tender"},

    # Сметы
    {"name": "Цена ниже исторической медианы — подними", "category": "Estimate"},
    {"name": "Похожий объект был с маржой выше — изучи", "category": "Estimate"},

    # Перерасход
    {"name": "Материалы > 5% от нормы — проверь", "category": "Estimate"},
    {"name": "Заявка сверх бюджета > 10% — обоснуй", "category": "Estimate"},

    # Безопасность
    {"name": "Допуск истекает < 30 дней", "category": "Safety"},
    {"name": "Допуск истёк — заблокируй на объекте", "category": "Safety"},

    # Субподряд
    {"name": "Аванс отдан > 21 дня без работы — спроси", "category": "Subcontract"},
    {"name": "Низкий рейтинг суба — предупреди", "category": "Subcontract"},

    # Техника
    {"name": "ТО просрочено — поставь в график", "category": "Equipment"},
]
```

---

## 6. БЛОК H · Управление техникой (новое)

### 6.H.1 Equipment ⭐

```yaml
DocType: Equipment
naming: "EQ-{####}"
title_field: equipment_name

fields:
  # Идентификация
  - equipment_code: Data, unique           # инвентарный номер
  - equipment_name: Data, required         # «Подъёмник Genie Z-45/22»
  - equipment_type: Select [
      "Подъёмник",                     # ножничный, телескопический
      "Кран",                          # башенный, автокран
      "Бетономешалка",
      "Компрессор",
      "Сварочный аппарат",
      "Краскопульт / окрасочное обор.",
      "Виброплита",
      "Вибратор глубинный",
      "Перфоратор / отбойный молоток",
      "Генератор",
      "Промышленный пылесос",
      "Тепловая пушка",
      "Леса / опалубка",
      "Промальп оборудование",          # верёвки, обвязки, спусковые
      "Грузовая техника",              # самосвал, манипулятор
      "Прочее"
    ]

  # Основные характеристики
  - manufacturer: Data
  - model: Data
  - manufacture_year: Int
  - serial_number: Data

  # Транспорт (если применимо)
  - is_transport: Check                    # это транспортное средство?
  - vin: Data                              # VIN
  - state_number: Data                     # госномер
  - registration_certificate: Attach       # ПТС/СТС

  # Финансы
  - purchase_date: Date
  - purchase_price: Currency
  - current_value: Currency                # балансовая стоимость
  - depreciation_rate_pct: Percent (default: 10)  # годовая амортизация

  # Состояние
  - status: Select [
      "Доступна",
      "На объекте",                    # в работе
      "На ТО",
      "В ремонте",
      "Списана",
      "Сдана в аренду"
    ] default: "Доступна"

  - current_location: Data                 # «Объект Marins Park»
  - current_project: Link → Project        # на каком объекте сейчас
  - current_responsible: Link → Employee   # ответственный

  # Графики
  - next_maintenance_date: Date
  - next_inspection_date: Date             # ТО / поверка
  - next_insurance_date: Date              # страховка
  - sro_certificate_date: Date             # СРО (для подъёмников и крана)

  # Часы работы
  - total_engine_hours: Float              # моточасы
  - total_mileage_km: Float                # пробег (если транспорт)

  # Аренда (если сдаём)
  - is_rentable: Check
  - daily_rent_rate: Currency

  # Документы
  - photos: Table → Equipment Photo
  - documents: Table → Equipment Document

  # Связи
  - maintenance_logs: Table → Maintenance Log Link
  - fuel_logs: Table → Fuel Log Link

automatic_actions:
  - При next_maintenance_date <= today + 7: AI Recommendation
  - При next_insurance_date <= today + 30: AI Recommendation + Telegram
  - При status = "В ремонте": блокировать назначение на проект
```

### 6.H.2 Maintenance Log

```yaml
DocType: Maintenance Log
naming: "ML-{equipment_code}-{####}"
fields:
  - equipment: Link → Equipment, required
  - log_date: Date, required
  - log_type: Select [
      "Плановое ТО",
      "Внеплановое ТО",
      "Ремонт",
      "Техосмотр",
      "Поверка",
      "Замена расходников",
      "Калибровка"
    ]

  # Что сделали
  - description: Text Editor, required     # описание работ
  - parts_replaced: Table → Replaced Part
  - service_company: Link → Supplier       # сервисная компания
  - performed_by: Link → Employee          # или собственный механик

  # Стоимость
  - parts_cost: Currency
  - labor_cost: Currency
  - total_cost: Currency

  # Привязка
  - related_purchase_orders: Table → PO Link  # заказы запчастей

  # Результат
  - is_successful: Check (default: True)
  - failure_reason: Small Text
  - next_maintenance_recommended_at: Date

  # Документы
  - act_attachment: Attach                 # акт выполненных работ
  - photos: Table → Photo

automatic_actions:
  - При создании: обновить equipment.next_maintenance_date
  - При log_type = "Поверка": обновить equipment.next_inspection_date
  - Suma по году: считается стоимость владения
```

### 6.H.3 Fuel Log

```yaml
DocType: Fuel Log
naming: "FL-{equipment_code}-{####}"
fields:
  - equipment: Link → Equipment, required
  - log_date: Date, required
  - log_time: Time

  # Заправка
  - fuel_type: Select [
      "АИ-92",
      "АИ-95",
      "АИ-98",
      "Дизель",
      "Газ",
      "Электро (кВт·ч)"
    ]
  - quantity: Float                        # литров (или кВт·ч)
  - price_per_unit: Currency
  - total_amount: Currency

  # Где
  - fuel_station: Data                     # «Лукойл» / «Газпромнефть»
  - location: Data                         # адрес
  - is_at_site: Check                      # заправка прямо на объекте?

  # Кто
  - filled_by: Link → Employee             # кто заправил
  - project: Link → Project                # на какой проект списать ГСМ

  # Показания
  - mileage_at_refuel: Float               # пробег при заправке
  - engine_hours_at_refuel: Float          # моточасы

  # Документы
  - receipt_attachment: Attach             # чек

  # Связь с расходами
  - expense_entry: Link → Journal Entry    # автосозданная проводка

# Аналитика:
# - Расход на 100 км / на моточас
# - Аномалии расхода (пересчёт на проект)
# - Сравнение по моделям техники
```

---

## 7. БЛОК I · Голосовой ввод (новое)

### 7.I.1 Voice Note ⭐

```yaml
DocType: Voice Note
naming: "VN-{YYYY}-{MM}-{####}"
fields:
  # Источник
  - user: Link → User, required
  - recorded_at: Datetime
  - source: Select [
      "Telegram",
      "Mobile PWA",
      "Web (microphone)",
      "AI Conversation"
    ]

  # Аудио
  - audio_file: Attach, required           # MP3/OGG/WAV
  - audio_duration_seconds: Float
  - audio_size_kb: Int
  - language: Select [Russian, English] default: Russian

  # Транскрипция
  - is_transcribed: Check
  - transcription_status: Select [Pending, Processing, Done, Failed]
  - transcription_text: Long Text          # результат
  - transcription_confidence: Percent      # уверенность модели
  - transcription_model: Data              # «whisper-large-v3»
  - transcription_cost_rub: Currency

  # Распознавание интента (NLP)
  - is_intent_recognized: Check
  - detected_intent: Select [
      "Foreman Report",                # «закрыл этап Х»
      "Material Request",              # «нужно Х материала»
      "Issue Report",                  # «проблема: Х»
      "Question to AI",                # вопрос AI-ассистенту
      "Note",                          # просто заметка
      "Unrecognized"
    ]
  - intent_confidence: Percent
  - extracted_entities: JSON               # {project: "Marins", qty: 2, item: "праймер"}

  # Действие
  - created_doctype: Link → DocType        # что создалось из заметки
  - created_record: Data                   # ID записи
  - is_acted_on: Check

  # Контекст
  - related_project: Link → Project        # к какому проекту относится
  - location_lat: Float                    # GPS если есть
  - location_lng: Float

# Use cases:
# 1. Прораб голосом: «На Marins Park закрыл утеплитель, нужно ещё 200кг праймера»
#    → создаются Foreman Report + Material Request
# 2. Директор голосом: «Сколько мы заработали на АКЗ за прошлый год?»
#    → AI Conversation
# 3. Сметчик голосом во время выезда: «Объект 1500 м², состояние хорошее»
#    → Voice Note с tags
```

### 7.I.2 Расширение Foreman Report

```yaml
# Уже существует Foreman Report — добавляем поля:

fields_added:
  - voice_note: Link → Voice Note          # из голосовой заметки?
  - is_voice_originated: Check             # создан из голоса
  - voice_confidence: Percent              # подтверждение нужно?
```

---

## 8. Расчётная логика — AI Cashflow (примеры)

### 8.1 Customer Payment Pattern (еженедельный пересчёт)

```python
def calculate_customer_payment_pattern(customer):
    # Берём все КС-3 за последние 24 месяца
    invoices = KS3.query(
        customer=customer,
        date__gte=today - 24*30,
        status__in=["Paid", "Partially Paid"]
    )

    payment_days = []
    for inv in invoices:
        payment = PaymentEntry.where(invoice=inv).first()
        if payment:
            days = (payment.posting_date - inv.invoice_date).days
            payment_days.append(days)

    if len(payment_days) < 3:
        return None  # недостаточно данных

    pattern = CustomerPaymentPattern()
    pattern.customer = customer
    pattern.average_payment_days = mean(payment_days)
    pattern.median_payment_days = median(payment_days)
    pattern.std_dev_payment_days = stdev(payment_days)

    # Сегментация
    if pattern.median_payment_days < 14 and pattern.std_dev_payment_days < 5:
        pattern.rating = "A"
    elif pattern.median_payment_days < 30:
        pattern.rating = "B"
    elif pattern.median_payment_days < 45:
        pattern.rating = "C"
    else:
        pattern.rating = "D"

    # Тренд: последние 6 мес vs предыдущие 6
    recent = [d for inv, d in zip(invoices, payment_days)
              if inv.date > today - 6*30]
    older = [d for inv, d in zip(invoices, payment_days)
             if inv.date <= today - 6*30 and inv.date > today - 12*30]

    if len(recent) >= 3 and len(older) >= 3:
        delta = median(recent) - median(older)
        pattern.trend_delta_days = delta
        if delta < -3: pattern.trend = "Improving"
        elif delta > 3: pattern.trend = "Worsening"
        else: pattern.trend = "Stable"

    pattern.save()
```

### 8.2 Cashflow Forecast (ежедневное создание snapshot)

```python
def create_cashflow_forecast_snapshot():
    snapshot = CashflowForecastSnapshot()
    snapshot.snapshot_date = today

    # 1. Текущий остаток
    snapshot.current_balance = sum_balance_all_accounts()

    # 2. Прогноз поступлений 30 дней
    incoming = []
    for ks2 in KS2Act.where(status="Подписан", payment_received=False):
        customer = ks2.customer
        pattern = CustomerPaymentPattern.get(customer)

        # Используем медиану + дату подписания
        eta_date = ks2.signed_date + timedelta(days=pattern.median_payment_days)

        if eta_date <= today + 30:
            incoming.append({
                "date": eta_date,
                "amount": ks2.amount,
                "ks2_id": ks2.name,
                "customer": customer.name,
                "confidence": 100 - pattern.std_dev_payment_days
            })

    # 3. Прогноз платежей 30 дней
    outgoing = []
    for po in PurchaseOrder.where(status="Оплата", payment_made=False):
        eta_date = po.payment_date_planned
        if eta_date <= today + 30:
            outgoing.append({
                "date": eta_date,
                "amount": po.amount,
                "supplier": po.supplier
            })

    # 4. Дневная картина
    daily = []
    balance = snapshot.current_balance
    for d in date_range(today, today + 30):
        day_in = sum(i.amount for i in incoming if i.date == d)
        day_out = sum(o.amount for o in outgoing if o.date == d)
        balance += day_in - day_out
        daily.append({"date": d, "incoming": day_in,
                     "outgoing": day_out, "balance": balance})

    # 5. Минимум кассы
    min_day = min(daily, key=lambda x: x["balance"])
    snapshot.forecast_30d_min_balance = min_day["balance"]
    snapshot.forecast_30d_min_date = min_day["date"]

    if min_day["balance"] < 0:
        snapshot.is_cash_gap_predicted = True
        snapshot.cash_gap_amount = abs(min_day["balance"])
        snapshot.cash_gap_date = min_day["date"]

        # AI Recommendation
        create_ai_recommendation(
            type="Cashflow Risk",
            urgency="Critical",
            title=f"Кассовый разрыв через {(min_day['date'] - today).days} дней",
            estimated_value=abs(min_day["balance"]),
            target_user=director,
            suggested_action="Просмотри cashflow и КС-2 на закрытие"
        )

    snapshot.save()
```

---

## 9. RAG-логика для AI Knowledge Base (упрощённо)

```python
# При запросе пользователя:

def answer_director_question(user, question, conversation_id):
    # 1. Создаём embedding запроса
    query_embedding = openai.embeddings.create(
        model="text-embedding-3-large",
        input=question
    ).data[0].embedding

    # 2. Ищем top-10 релевантных чанков (cosine similarity)
    relevant_chunks = AIKnowledgeChunk.query(
        access_level__in=user.allowed_access_levels(),
        embedding__similar_to=query_embedding,
        limit=10
    )

    # 3. Reranking — берём top-5 после переоценки
    reranked = rerank_with_llm(question, relevant_chunks, model="gpt-4o-mini")
    top_chunks = reranked[:5]

    # 4. Собираем контекст
    context = "\n\n".join([
        f"[{c.parent.document_title}]\n{c.chunk_text}"
        for c in top_chunks
    ])

    # 5. Запрос к LLM
    response = anthropic.messages.create(
        model="claude-opus-4-7",
        max_tokens=2000,
        system=f"""Ты — AI-ассистент строительной компании «Олимп».
        Отвечай на основе предоставленных данных. Если данных не хватает — скажи об этом.
        Используй точные числа и ссылайся на документы по их названию.
        Сегодня: {today}.

        Релевантные документы:
        {context}
        """,
        messages=[{"role": "user", "content": question}]
    )

    # 6. Сохраняем в conversation
    save_to_conversation(conversation_id, role="user", content=question)
    save_to_conversation(conversation_id, role="assistant",
                        content=response.content,
                        retrieved_chunks=[c.id for c in top_chunks])

    return response.content
```

---

## 10. Связи между сущностями (обновлённая ER-диаграмма)

```
                                     ┌──────────────┐
                                     │   Project    │
                                     └──────┬───────┘
                                            │
        ┌───────────────────────────────────┼───────────────────────────┐
        ↓                                   ↓                           ↓
   ┌──────────┐                      ┌─────────────┐            ┌──────────────┐
   │ Estimate │                      │ KS2 Act     │            │ Equipment    │
   └────┬─────┘                      └──────┬──────┘            │ (на объекте) │
        │                                   │                    └──────┬───────┘
        │     ┌─────────────────────────┐  │                           │
        ↓     ↓                         │  ↓                           ↓
   ┌──────────────────┐                │ ┌──────────────────┐    ┌────────────┐
   │ AI Knowledge Doc │←───── индексация├─┤ Customer Payment │    │ Maint. Log │
   │  + Chunks        │                │ │ Pattern (analytics)│    │ + Fuel Log │
   └────────┬─────────┘                │ └──────┬───────────┘    └────────────┘
            │                          │        │
            │ retrieval                │        ↓
            ↓                          │ ┌─────────────────────┐
   ┌──────────────────┐                │ │ Cashflow Forecast   │
   │ AI Conversation  │                │ │ Snapshot (daily)    │
   │ + Messages       │                │ └──────┬──────────────┘
   └──────────────────┘                │        │
            ↑                          │        ↓
            │                          │ ┌──────────────────────┐
   ┌──────────────────┐                └→│ AI Recommendation    │
   │   Voice Note     │                  │  + Pattern (rules)   │
   │ (Telegram/PWA)   │─────────────────→│                      │
   └──────────────────┘                  └──────────────────────┘
```

---

## 11. Названия и нумерация (обновлённые)

| DocType | Префикс | Пример |
|---------|---------|--------|
| AI Knowledge Document | AKD | AKD-0234 |
| AI Conversation | AIC | AIC-2026-05-1245 |
| Customer Payment Pattern | CPP | CPP-VIZ-Stal |
| Cashflow Forecast Snapshot | CFS | CFS-2026-05-09 |
| AI Recommendation | AIR | AIR-2026-05-0089 |
| AI Pattern | PAT | PAT-0014 |
| Equipment | EQ | EQ-0034 |
| Maintenance Log | ML | ML-EQ-0034-0012 |
| Fuel Log | FL | FL-EQ-0034-0245 |
| Voice Note | VN | VN-2026-05-0867 |

---

## 12. Сравнение версий v1 → v5

| Версия | Дата | DocType | Часов | Стоимость | Что добавлено |
|--------|------|---------|-------|-----------|---------------|
| v1 | до интервью | — | — | — | концепция |
| v2 | после интервью | — | — | — | архитектура (концепт) |
| v3 | первая SCHEMA | 21 | ~511 | ~1,72M | базовое ядро |
| v4 | после ТЗ v1 | 34 | ~932 | ~2,66M | + сметы, склад, заявки, графики |
| **v5** | **после ТЗ v2** | **46** | **~1340** | **~3,2M** | + AI ассистент, AI cashflow, техника, голос |

---

## 13. Что осталось НЕ покрытым (сознательно)

| Из ТЗ v2 | Почему не берём |
|----------|-----------------|
| BIM-просмотрщик (3D модели) | Нет заказчиков с моделями |
| Цифровой двойник | Маркетинговая абстракция |
| IoT датчики (LoRaWAN, Zigbee) | Не используется в АКЗ/кровле/промальпе |
| Компьютерное зрение (Buildots) | Требует BIM-модель |
| Дроны как платформа | Используем как процесс (фотоотчёт) |
| AR на мобильном | Технология не созрела |
| Биометрия / Face ID | Overkill для команды 5-15 чел |
| RFI / Submittals / Punch List / Change Orders | Российские заказчики не работают по этой методологии |
| Портфельное управление (Program Management) | Когда будет 20+ проектов |
| Клиентский портал | Когда крупные заказчики потребуют |
| Construction IQ (Autodesk-style) | Перебор для 5-15 пользователей |
| ML прогноз задержек (nPlan) | Нет данных для обучения. Регрессия достаточно |
| Multi-currency | Олимп работает в ₽ |
| 500+ одновременных пользователей | У вас 5-15 |
| Шардирование БД | После 50+ пользователей |
