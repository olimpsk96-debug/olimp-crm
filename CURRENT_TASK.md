# CURRENT_TASK.md

**Обновляется в начале и в конце каждой сессии разработки.**
**Claude Code читает этот файл первым делом — здесь актуальная задача.**

---

## 📍 Текущая фаза

**Фаза 1 — Тендеры** (pipeline + AI score + Telegram-алерты)

---

## ✅ Что уже сделано в Фазе 1

- [x] Workflow-фикстура `fixtures/tender_workflow.json` — 7 состояний, 8 переходов
- [x] `tender.py` усилен: валидация цены, суммы победы, даты подачи
- [x] `test_tender.py` — 13 тестов, все проходят (`bench run-tests`)

- [x] DocType `Tender` создан в ERPNext (все поля: title, status, customer, tender_law, work_type, region, nmck, our_price, margin_pct, deadline_date, deadline_time, ai_match_score, ai_recommendation, result, ...)
- [x] Frappe API endpoint `olimp_construction.api.tender.get_pipeline` (`@frappe.whitelist()`)
- [x] Frappe API ключи созданы и добавлены в `.env` (FRAPPE_API_KEY, FRAPPE_API_SECRET)
- [x] Next.js server-side proxy `GET /api/tenders` → проксирует на Frappe с авторизацией
- [x] Kanban pipeline `/tenders`: 6 колонок, карточки TenderCard, статистика
- [x] Тестовый тендер TND-2026-0001 создан и отображается в UI
- [x] Telegram helper `telegram_utils.py`: `send_message()`, `format_deadline_alert()`
- [x] `check_tender_deadlines()` в tasks.py: отправляет алерты за 7/3/1 день до дедлайна
- [x] docker-compose.yml: TELEGRAM_BOT_TOKEN + TELEGRAM_DIRECTOR_CHAT_ID переданы в backend и scheduler

## ✅ Сделано (1.3 + 1.4)

**1.3 — Telegram алерты:**
- [x] Бот @Olimp_erp_bot, токен + chat_id директора (64348130) в `.env`
- [x] Алерты за 7/3/1 день — cron daily в полночь

**1.4 — AI-оценка тендеров:**
- [x] `api/ai/tender_score.py` — endpoint `score_tender`, Claude Haiku
- [x] Next.js proxy `POST /api/tenders/score`
- [x] Кнопка «AI?» / «AI» в каждой карточке Kanban
- [x] `ANTHROPIC_API_KEY` в `.env` и docker-compose
- ⚠️ **Нужно пополнить баланс** на console.anthropic.com → Plans & Billing

---

- [x] **1.5 — Drawer деталей тендера** — `TenderDrawer.tsx`, API routes GET+PATCH `/api/tenders/[name]`, смена статуса из UI, закрытие по Escape/backdrop
- [x] Статистика «Дедлайны < 3д» добавлена в шапку страницы

## ✅ Сделано (1.6)

**1.6 — Синхронизация TenderOK (заготовка):**
- [x] `n8n/workflows/tenderguru-sync.json` — workflow (inactive, ключи добавлены в .env)
- [x] `api/tender.py` — endpoint `create_from_tenderguru()` с маппингом полей TenderGuru
- [x] `.env` — TENDERGURU_API_KEY + TENDERGURU_REFRESH_KEY добавлены
- [x] `docker-compose.yml` — переменные переданы в контейнер n8n
- ⚠️ **Workflow inactive** — импортировать JSON в n8n UI → установить Active после проверки

---

## 📍 Текущая фаза

**Фаза 2 — Сметы** (DocType + редактор + импорт XML)

## ✅ Сделано (2.1)

**2.1 — DocType Estimate + frontend:**
- [x] `doctype/estimate/estimate.json + estimate.py` — авто-расчёт позиций и маржи
- [x] `doctype/estimate_item/estimate_item.json` — child table позиций
- [x] `api/estimate.py` — `get_list`, `get_detail`, `save_estimate`, `import_from_gs_xml`
- [x] `frontend/app/(dashboard)/layout.tsx` — сайдбар с навигацией
- [x] `frontend/app/(dashboard)/estimates/page.tsx` — список смет
- [x] `frontend/components/estimates/EstimateDrawer.tsx` — drawer с позициями + импорт XML
- [x] API routes: GET/POST `/api/estimates`, GET/PUT `/api/estimates/[name]`, POST `/api/estimates/import-xml`
- [x] `frontend/types/estimate.ts` — TypeScript типы
- [x] Build проходит без ошибок

- [x] Migrate применён: DocType Estimate + Estimate Item в БД
- [x] `test_estimate.py` — 16 тестов, все OK
- [x] `test_tender.py` — 13 тестов, все OK (fixed: workflow bypass + sync result→status)
- [x] Итого: **29/29 тестов зелёные**
- [x] `tender_workflow.json` — исправлен (Проиграли/Отклонён: doc_status=0, добавлен workflow_name)

## ✅ Сделано (UI-аудит, сессия 3 — 11.05.2026)

**Тестирование и фиксы после аудита portal:**
- [x] PATCH `/api/tenders/[name]` → теперь вызывает `set_status` (обходит Frappe Workflow, возвращает `{ok: true}`)
- [x] Статус "Подана" → "Заявка подана", "Отменён" → "Отклонён" (синхронизация с бэкендом)
- [x] `TenderStatus` type в `types/tender.ts` исправлен
- [x] `KanbanColumn`, `TenderDrawer`, `STATUS_OPTIONS/COLOR` — обновлены
- [x] Баг: XML-импорт создавал новую смету вместо обновления текущей → исправлен:
  - `import_from_gs_xml` принимает `estimate_name`: если существует — заменяет позиции
  - route.ts пробрасывает `estimate_name`
  - EstimateDrawer перезагружает нужную смету (updated или created)
- [x] TypeScript проверка: 0 ошибок

**Что работает (проверено через API):**
- GET `/api/tenders` → 1 тендер TND-2026-0001 ✓
- GET `/api/estimates` → 1 смета EST-2026-00001 (1.85M→2.09M, 11.6% маржа) ✓
- GET `/api/estimates/EST-2026-00001` → 9 позиций с is_section ✓
- PATCH статуса тендера работает ✓
- Kanban колонки корректно матчатся со статусами ✓

## ✅ Сделано (Фаза 3 — Снабжение, 11.05.2026)

- [x] `material_request.json + .py` — autoname MR-.YYYY.-.#####, авто-расчёт total_estimated
- [x] `supply_item.json + .py` — child table (qty × price → amount)
- [x] `api/supply.py` — get_list, get_detail, save_request, set_status
- [x] Миграция применена ✓
- [x] `types/supply.ts`, API routes, `SupplyDrawer`, `SupplyCreateDrawer`, страница `/supply`
- [x] Сайдбар: пункт «Снабжение», v0.3 · Фаза 3
- [x] Тест: MR-2026-00001, 348 600 ₽, 3 позиции ✓

## ✅ Сделано (Фаза 4 — КС-2, 11.05.2026)

- [x] `ks2_act.json + .py` — autoname KS-.YYYY.-.#####, авто-расчёт суммы, auto signed_date
- [x] `ks2_item.json + .py` — child table (qty × unit_price → amount)
- [x] `api/ks2.py` — get_list, get_detail, save_act, set_status, import_from_estimate
- [x] Миграция применена ✓
- [x] `types/ks2.ts`, API routes, `KS2Drawer`, `KS2CreateDrawer` с импортом из сметы, страница `/ks2`
- [x] Сайдбар: пункт «КС-2», версия → v0.4 · Фаза 4
- [x] Тест: KS-2026-00001, 841 500 ₽, 4 позиции ✓
- [x] TypeScript: 0 ошибок

## ✅ Сделано (Фаза 5 — Cashflow, 11.05.2026)

- [x] `api/cashflow.py` — `get_dashboard` (агрегирует KS2 + Supply), `set_balance` (frappe.db.set_default)
- [x] Прогноз по 3 месяцам: income/expense/net сгруппированы по due_date
- [x] `types/cashflow.ts`, API route GET+POST `/api/cashflow`
- [x] `/cashflow` page: KPI-блок (баланс с inline-редактированием, поступления, расходы, прогноз)
- [x] CSS-гистограмма по месяцам без внешних библиотек
- [x] Двухколоночный список: ожидаемые поступления / плановые расходы
- [x] Сайдбар: пункт «Cashflow», версия → v0.5 · Фаза 5
- [x] TypeScript: 0 ошибок
- [x] Тест: баланс 1.5M ₽, поступлений 841.5K (KS-2026-00001), расходов 348.6K → прогноз 1.99M ₽ ✓

## ✅ Сделано (Фаза 6 — Прорабы + ОТ/ТБ, 11.05.2026)

- [x] DocType `Foreman Report` — FR-.YYYY.-.#####, поля: прораб, дата, кол-во рабочих, работы, проблемы, ОТ/ТБ-флаг, материалы, техника
- [x] DocType `Safety Incident` — SI-.YYYY.-.#####, серьёзность: Незначительный/Средний/Тяжёлый/Критический
- [x] Миграция применена ✓
- [x] `api/foreman.py` — get_reports, get_incidents, save_report, save_incident, set_*_status, get_stats
- [x] Next.js API routes: GET+POST `/api/foreman/report`, `/api/foreman/incident`, GET+PATCH `/api/foreman/report/[name]`, `/api/foreman/incident/[name]`, GET `/api/foreman/stats`
- [x] `types/foreman.ts`
- [x] `/safety` page: stats bar (отчётов/месяц, рабочих сегодня, открытых инцидентов, критических), два drawer (отчёт + инцидент), двухколонный список с inline смена статусов
- [x] Сайдбар: пункт «ОТ/ТБ», версия → v0.6 · Фаза 6
- [x] TypeScript: 0 ошибок
- [x] Тест: FR-2026-00001 (8 рабочих, статус «Отправлен») + SI-2026-00001 (Средний, «Открыт») ✓

## ✅ Сделано (Фаза 7 — AI-ассистент, 11.05.2026)

- [x] `@anthropic-ai/sdk` установлен в frontend
- [x] `ANTHROPIC_API_KEY` добавлен в `frontend/.env.local`
- [x] `app/api/ai/chat/route.ts` — SSE-стриминг: собирает контекст из Frappe (тендеры, касса, КС-2, инциденты, отчёты прорабов), вызывает Claude Haiku
- [x] `/ai` page — чат UI: приветствие с подсказками, пузыри сообщений, стриминг в реальном времени, авто-расширение input, typing-индикатор
- [x] Сайдбар: пункт «AI», версия → v0.7 · AI
- [x] TypeScript: 0 ошибок, SSE endpoint отвечает корректно
- ⚠️ **Нужно пополнить баланс** на console.anthropic.com → Plans & Billing (та же проблема, что в 1.4)

## ✅ Сделано (Фаза 8 — Техника, 11.05.2026)

- [x] DocType `Equipment` — EQ-.YYYY.-.####, категории: Подъёмники/АКЗ/Бетон/Сварка/Промальп/Грузовая/Прочее, статусы: Доступна/На объекте/На ТО/В ремонте/Списана
- [x] DocType `Maintenance Log` — ML-.YYYY.-.#####, авто-расчёт total_cost, on_update → обновляет next_maintenance_date на карточке Equipment
- [x] DocType `Fuel Log` — FL-.YYYY.-.#####, авто-расчёт total_amount, обновляет odometer/engine_hours на карточке
- [x] Миграция применена ✓
- [x] `api/equipment.py` — get_list, get_detail (с историей ТО + fuel_30d), save_equipment, set_status, log_maintenance, log_fuel, get_stats
- [x] Next.js API routes: GET+POST `/api/equipment`, GET+PATCH `/api/equipment/[name]`, GET `/api/equipment/stats`, POST `/api/equipment/maintenance`, POST `/api/equipment/fuel`
- [x] `types/equipment.ts`
- [x] `/equipment` page: статистика с кликабельными фильтрами по статусу, таблица с ТО-алертом «через N дней», detail drawer (3 таба: сведения/ТО/ГСМ), create drawer
- [x] Сайдбар: пункт «Техника», версия → v0.8 · Фаза 8
- [x] TypeScript: 0 ошибок
- [x] Тест: EQ-2026-0001 (Haulotte), ML-2026-00001 (12 700 ₽, дата ТО → 2026-07-10), FL-2026-00001 (45 л, 2 632 ₽) ✓

## ✅ Сделано (Фаза 9 — Командный центр, 11.05.2026)

- [x] `api/dashboard.py` — `get_command_center()`: агрегирует все 8 модулей, приоритизирует алерты (critical → warning), форматирует суммы через `_fmtm()`
- [x] `app/api/dashboard/route.ts` — GET-прокси к `get_command_center`
- [x] `/dashboard` page — командный центр с авто-рефрешем 60s:
  - 4-колоночная cashflow-строка (баланс / поступления / расходы / прогноз), карточки ведут в модули
  - Алерты: 2-колоночная сетка, critical выше warning, цветные карточки с навигацией
  - 3×2 грид модулей: Тендеры / КС-2 / Прорабы+ОТ/ТБ / Техника / Снабжение / Быстрые действия
- [x] Сайдбар: «Дашборд» — первый пункт, версия → v0.9 · Фаза 9
- [x] Root redirect: `/` → `/dashboard`
- [x] TypeScript: 0 ошибок
- [x] Тест API: `/api/dashboard` возвращает корректные данные: баланс 1.5M, прогноз 1.99M, 1 алерт (ОТ/ТБ Средний) ✓

## ✅ Сделано (CRM — v1.0, 11.05.2026)

- [x] DocType `Interaction` — INT-.YYYY.-.#####: тип (Звонок/Встреча/Письмо/Тендер), клиент, дата, содержание, результат, следующий шаг
- [x] DocType `Deal` — DL-.YYYY.-.#####: воронка (Лид→Переговоры→КП→Договор→Выиграно/Проиграно), сумма, вероятность, источник
- [x] Миграция применена, DocTypes созданы в БД ✓
- [x] `api/crm.py` — get_clients (со статистикой тендеров/КС-2/сделок), get_client (detail: история/тендеры/КС-2/сделки), save_interaction, get_deals, save_deal, set_deal_status, get_crm_stats
- [x] Next.js API routes: GET `/api/crm`, GET `/api/crm/client`, GET `/api/crm/stats`, POST `/api/crm/interactions`, GET+POST `/api/crm/deals`
- [x] `types/crm.ts` — CrmClient, ClientDetail, Interaction, Deal, CrmStats
- [x] `/clients` page — таблица клиентов (12 клиентов, статы: сделки/тендеры/КС-2/последний контакт), drawer с табами: История / Тендеры / КС-2 / Сделки, форма добавления взаимодействия
- [x] `/deals` page — Kanban воронка (5 активных колонок + закрытые), смена статуса через меню ⋮, создание сделок
- [x] Сайдбар: «Клиенты» и «Сделки» после Дашборда, версия → v1.0 · CRM
- [x] TypeScript: 0 ошибок
- [x] Тест: 12 клиентов, 3 сделки в воронке (11.5M ₽), 3 взаимодействия за неделю, 1 просроченный next_action ✓

## ✅ Сделано (CRM v1.1 — создание клиентов + интеграция с дашбордом, 11.05.2026)

**Создание клиентов и контактов из UI:**
- [x] `api/crm.py` — `save_client()` с дефолтами territory=All Territories, group=Commercial
- [x] `api/crm.py` — `save_contact()` создаёт Contact с привязкой через Dynamic Link
- [x] `api/crm.py` — `delete_contact()`
- [x] Next.js routes: POST `/api/crm`, POST+DELETE `/api/crm/contacts`
- [x] `ClientCreateDrawer` — форма «+ Новый клиент» на странице `/clients`
- [x] Вкладка «Контакты» в drawer клиента: добавление, телефон/email с tel:/mailto: ссылками, удаление
- [x] Тест: создан клиент «ООО Стройпроект Тест» + контакт «Сергей Петров» (главный инженер) ✓

**Интеграция CRM в командный центр:**
- [x] `dashboard.py` — добавлена секция `crm`: total_clients, active_deals, pipeline_total, next_actions, deals_pipeline
- [x] Алерты CRM в дашборд: «Задача на сегодня» (warning) / «Просроченная задача» (critical)
- [x] Карточка «CRM — Следующие шаги» на дашборде: счётчики + список задач с просрочкой
- [x] Быстрые действия: добавлены «Новый клиент» и «Новая сделка»
- [x] Тест дашборд API: 12 клиентов, 3 сделки (11.5M ₽ в воронке), 2 next_actions в alerts ✓

**Telegram-напоминания CRM:**
- [x] `tasks.py` — `check_crm_followups()`: daily cron, отправляет сводку «задачи на сегодня + просроченные» в Telegram директора
- [x] `hooks.py` — task зарегистрирован в `scheduler_events.daily`

## ✅ Сделано (Фаза 11 — Проекты, 12.05.2026)

**Архитектурное закрытие пробела: DocType `Construction Project`**

- [x] Создан DocType `Construction Project` (не `Project` — чтобы не конфликтовать с ERPNext Projects)
- [x] Все 8 ссылок Link → "Project" в Tender, Estimate, KS2 Act, Material Request, Foreman Report, Safety Incident, Equipment, Fuel Log → переведены на `Construction Project`
- [x] Привязаны существующие данные (НПП Старт) к PR-2026-0001: смета EST-2026-00001, тендер TND-2026-0001, акт KS-2026-00001, заявка MR-2026-00001, отчёт FR-2026-00001, инцидент SI-2026-00001, техника EQ-2026-0001
- [x] `api/project.py` — get_list (агрегаты: КС-2/снабжение/инциденты/дни), get_detail (полная карточка), save_project, set_status, get_stats, create_from_tender
- [x] Авто-создание Project при выигрыше тендера (`tender.py.on_update`)

**Frontend:**
- [x] `types/project.ts` — ProjectListItem, ProjectDetail, ProjectMargin, ProjectStats
- [x] API routes: GET+POST `/api/projects`, GET `/api/projects/detail`, GET `/api/projects/stats`, POST `/api/projects/status`, POST `/api/projects/from-tender`
- [x] `/projects` — список проектов: 4 KPI-карточки, фильтры по статусу, карточки с прогресс-баром и метриками (контракт, КС-2, оплачено, дни до сдачи)
- [x] `/projects/[name]` — карточка проекта с 7 табами: Обзор / Смета / КС-2 / Снабжение / Техника / Отчёты прорабов / ОТ-ТБ
  - **План/факт маржа** (выручка, себестоимость, маржа ₽ и %) — главная боль директора закрыта
  - Прогресс-бар "Закрыто КС-2 / Контракт"
  - Дебиторка по проекту
  - Смена статуса прямо в шапке
- [x] Дашборд: блок «Активные проекты» с мини-прогрессбарами
- [x] Сайдбар: «Проекты» вторым пунктом, версия → v1.1 · Проекты
- [x] TypeScript: 0 ошибок
- [x] Тест: PR-2026-0001 — контракт 2.09M, прогресс 40% (закрыто 841K), план маржа 11.5% / факт 58.6%, дебиторка 841K ✓

## ✅ Сделано (Сотрудники и роли, 12.05.2026)

**8 кастомных ролей** для строительной компании:
- Прораб (отчёты, заявки на материалы, инциденты)
- Инженер ОТ-ТБ (инциденты, журналы)
- Главный инженер (техника, ТО, ГСМ)
- Сметчик (сметы, импорт Гранд-Сметы)
- Тендерный менеджер (тендеры, клиенты, AI-оценка)
- Снабженец (заявки, поставщики)
- Бухгалтер Олимп (КС-2/КС-3, оплаты)
- Менеджер продаж Олимп (CRM, сделки, контакты)

**Backend:**
- [x] `api/setup.py` — `setup_construction_roles()`: создаёт роли + 46 правил Custom DocPerm (роль × DocType × права)
- [x] `api/users.py` — get_employees, save_employee, toggle_employee, get_role_stats
- [x] Тест: создан пользователь `foreman@olimp-ural.ru` (Иван Прораб) с ролью «Прораб»

**Frontend:**
- [x] `/team` page — список сотрудников + статистика по ролям с описанием доступа к модулям
- [x] Drawer создания/редактирования сотрудника с подсказкой «какие модули доступны для роли»
- [x] Toggle активности (включить/отключить вход)
- [x] Сайдбар: «Сотрудники» добавлен, версия → v1.2 · Сотрудники
- [x] TypeScript: 0 ошибок

## ✅ Сделано (Аудит + рефакторинг, 12.05.2026)

**Детальный аудит** (через 4 параллельных субагента — Backend, Frontend, Bugs, UX): см. `AUDIT_2026_05_12.md`. Найдено: 15 страниц, 16 DocType, 37 API routes, 8 ролей, ~3000 строк дублированного CSS, 0% mobile responsiveness, 5 cron-заглушек.

**Параллельные фиксы (3 субагента):**
- [x] `lib/ui-styles.ts` — 17 общих стилей, рефакторены 4 страницы (clients, projects, deals, team)
- [x] **TenderLaw** синхронизирован: фронт ↔ бек = `"Коммерческий"` (3-я опция)
- [x] **STATUSES_ACTIVE** — устранено дублирование в 3 файлах (теперь импорт из `telegram_utils`)
- [x] **Material Request статус** «Получено» → «Получена» (везде согласовано)
- [x] **UX-фикс**: КС-2 в табе проекта теперь кликабельны (`/ks2?name=...`)
- [x] CLAUDE.md: 4 новых записи в разделе 18 «Подводные камни», добавлены разделы 0.2 (субагенты) и 0.3 (выбор моделей)

## ✅ Сделано (Фаза 12 — КС-3, 12.05.2026)

**Архитектура спланирована Plan-агентом на Opus** (~14 ч плана), реализация CRUD за 1 ч на Sonnet.

**Backend:**
- [x] DocType `KS3 Act` (autoname `KS3-.YYYY-.#####`) — поля: проект, КС-2 в справке, период, НДС, удержание, подписи, ОКУД 0322001
- [x] DocType `KS3 Item` (child table) — позиции с тремя суммами: с начала строит. / с начала года / за период
- [x] DocType `KS3 Linked Act` (child) — связь со списком КС-2 актов
- [x] Миграция применена, DocTypes в БД ✓
- [x] `api/ks3.py` — get_list, get_detail, save_act, set_status, **create_from_ks2** (умное создание справки из выбранных КС-2 с агрегацией по работам и расчётом нарастающих сумм), get_stats, get_ks2_for_project
- [x] `ks3_act.py.before_save` — автоматический расчёт total_period, НДС, удержания, итого к оплате; auto signed_date при статусе «Подписан»

**Frontend:**
- [x] `types/ks3.ts` — KS3Act, KS3Item, KS3LinkedAct, KS3Status, KS3Stats, KS2ForKS3
- [x] Next.js API routes: `/api/ks3` (GET+POST), `/api/ks3/detail`, `/api/ks3/stats`, `/api/ks3/status`, `/api/ks3/ks2-for-project`, `/api/ks3/create-from-ks2`
- [x] `/ks3` page — 4 KPI-карточки (всего/подписано/черновики/удержано), фильтр по статусу, таблица справок, кликабельные строки
- [x] **KS3CreateDrawer** — мастер создания: выбор проекта → автозагрузка КС-2 → чекбоксы для выбора → задание периода → создание
- [x] **KS3Drawer** — детальный просмотр: шапка с менюшкой смены статуса, период, связанные КС-2, таблица позиций (3 колонки сумм), блок итогов с НДС и удержанием, заглушки кнопок PDF/Excel
- [x] Сайдбар: «КС-3» после «КС-2», версия → v1.3 · КС-3
- [x] TypeScript: 0 ошибок

**Тест на реальных данных:**
- Создана KS3-2026-00001 из KS-2026-00001 → автоматически:
  - 4 позиции работ (Очистка, Обезжиривание, Грунт ВЛ-02, Эмаль ПФ-115)
  - Сумма за период: 841.5K ₽
  - НДС 20%: 168.3K ₽
  - Итого к оплате: 1.01M ₽
  - Связано: 1 акт КС-2 ✓

## ✅ Сделано (Фаза 12.2 — Печать КС-2/КС-3, 12.05.2026)

**Гос.формы Госкомстата (Постановление от 11.11.1999 № 100):**

**Backend:**
- [x] `print_format/kc_2_official/kc_2_official.html` — Jinja2-шаблон КС-2 (ОКУД 0322005, A4 landscape, 8-колоночная таблица)
- [x] `print_format/kc_3_official/kc_3_official.html` — Jinja2-шаблон КС-3 (ОКУД 0322001, A4 portrait, 6-колоночная таблица с тремя суммами + НДС + удержание)
- [x] `api/setup.py` → `setup_print_formats()` создаёт/обновляет Print Format в БД из HTML-файлов (idempotent)
- [x] `api/exports.py` — 4 whitelisted-метода:
  - `ks2_pdf(name)` / `ks3_pdf(name)` — рендер Print Format → wkhtmltopdf → PDF
  - `ks2_excel(name)` / `ks3_excel(name)` — openpyxl, форматирование 1-в-1 с гос.формой (объединённые ячейки, рамки, форматы чисел `#,##0.00`)

**Frontend:**
- [x] `app/api/ks2/export/route.ts` и `app/api/ks3/export/route.ts` — Next.js binary pass-through с правильным `Content-Type` и `Content-Disposition`
- [x] `components/ks2/KS2Drawer.tsx` — 3 кнопки внизу: «Скачать PDF» (акцент), «Скачать Excel» (success), «Открыть в ERPNext»
- [x] `app/(dashboard)/ks3/page.tsx` (KS3Drawer) — заменены заглушки «PDF/Excel (скоро)» на рабочие ссылки
- [x] TypeScript: 0 ошибок

**Тест (через Next.js proxy):**
- KS-2_KS-2026-00001.pdf → 26 KB, 2 стр., A4 landscape ✓
- KS-2_KS-2026-00001.xlsx → 6.8 KB, корректный xlsx ✓
- KS-3_KS3-2026-00001.pdf → 26 KB, 1 стр., A4 portrait ✓
- KS-3_KS3-2026-00001.xlsx → 6.9 KB, корректный xlsx ✓
- Jinja-подстановка: project_title, customer, ИНН, период, позиции, итоги, НДС — все поля заполняются

## ✅ Сделано (2.4 — Импорт сметы из Гранд-Сметы XML, 13.05.2026)

**Парсер переписан под реальный формат GrandSmeta v12.x** (Дима прислал боевую смету «Ремонт горизонтального шламбассейна №3», 34 позиции).

**Backend (`api/estimate.py`):**
- [x] `import_from_gs_xml()` теперь принимает bytes / str (CP1251 / UTF-8), безопасно нормализует XML declaration
- [x] `_extract_smr_index()` — читает индекс пересчёта из `<Indexes><IndexesPos><Index SMR="..."/></IndexesPos></Indexes>` (в реальной смете: 559.28)
- [x] `_extract_discount()` — читает понижающий договорной коэффициент из `<AddZatrats>` с `Options="…AsKf"` (Inactive игнорируется — это про неактивный НДС)
- [x] `_parse_gs_xml()` итерирует `<Chapters>/<Chapter>/<Position>` (НЕ `<Header/>`)
- [x] Берёт `Caption` / `Code` / `Units` из атрибутов позиции
- [x] Объём — из дочернего `<Quantity Result="..."/>` (надёжно: учитывает формулы `100/1000`, `=ОКР(700; 2)`)
- [x] Цена — из `<PriceBase PZ="..."/>` дочернего тега (это ПЗ в ценах 2001г)
- [x] Пересчёт: `base_unit_price = PZ × SMR` (текущие цены), `our_unit_price = base × (1 + discount_pct/100)`
- [x] `_extract_title()` — название из `<Properties Description="..."/>`
- [x] Комментарии (`Comment`, `DBComment`) собираются в поле `notes` позиции
- [x] Возвращает `summary` с метаданными: smr_index, discount_pct, rows, sections

**Frontend (`components/estimates/EstimateDrawer.tsx`):**
- [x] `handleImportXml` читает файл как ArrayBuffer и автоматически детектит кодировку из declaration XML
- [x] Поддержка windows-1251 / cp1251 / cyrillic → `TextDecoder("windows-1251")` (нативный, без библиотек)
- [x] Fallback на UTF-8 для современных файлов

**Тест:**
- Минифрагмент с реальной структурой (3 позиции, 1 раздел): 4 строки, индекс 559.28 применён, скидка −4.166% применена, активный НДС=Inactive проигнорирован
- 16/16 backend-тестов test_estimate зелёные ✓
- TypeScript: 0 ошибок ✓

⚠️ **Реальный приёмочный тест** — Дима загружает через UI настоящий XML «Смета №1 Гор.шламбассейн №3.xml» (34 позиции) и проверяет суммы.

## ✅ Сделано (cron-задачи + факт-маржа, 13.05.2026)

**3 рабочих cron + 3 аккуратных заглушки + событийный пересчёт маржи:**

**Реализованы полностью:**
- [x] `check_equipment_alerts` (daily) — алерты по ТО (7д), страховке/поверке/СРО (30д). Одно агрегированное Telegram-сообщение со списком, сортировка по дате. Игнорирует «Списана».
- [x] `check_safety_clearance_expiry` (daily) — алерты по открытым инцидентам ОТ/ТБ. Тяжёлые/Критические — каждый день. Незначительные/Средние — если висят >7 дней.
- [x] `recalculate_project_margin` (doc_event) — пересчёт по подписанным КС-2 (revenue) и Material Request в статусах Одобрена/Закупается/Получена (cost). Сохраняет в Custom Fields, не вызывает рекурсии (`db_set update_modified=False`).
- [x] `on_ks2_update_recalc_project` + `on_material_request_update_recalc_project` — каскадные хуки: меняешь КС-2 → пересчёт проекта.

**Заглушки с проверкой DocType (не падают в логах):**
- [x] `update_customer_payment_patterns` (weekly) — пропуск, если нет DocType `Customer Payment Pattern`
- [x] `generate_cashflow_snapshot` (weekly) — пропуск, если нет DocType `Cashflow Forecast Snapshot`
- [x] `run_ai_recommendation_engine` (hourly) — пропуск, если нет DocType `AI Pattern`

**Custom Fields на Construction Project:** добавлен раздел «Фактическая маржа (авто)» с полями `real_revenue`, `real_cost`, `real_margin_amount`, `real_margin_pct`, `ks2_completion_pct`. Применяются через `after_migrate` хук (`olimp_construction.install.sync_custom_fields`).

**Фиксы при попутно:**
- [x] `hooks.doc_events["Project"]` → `Construction Project` (был баг — стандартный ERPNext Project, а у нас кастомный)
- [x] Статусы Material Request в SQL: были «Заказана/Получена», правильно «Одобрена/Закупается/Получена»
- [x] CRM-сообщение в Telegram: Markdown `*звёздочки*` → HTML `<b>тэги</b>` (parse_mode по умолчанию `HTML` в `telegram_utils.send_message`)

**E2E-тест на PR-2026-0001:**
| Поле | Значение |
|---|---|
| contract_amount | 2 090 000 ₽ |
| real_revenue (1 КС-2 подписан) | 841 500 ₽ |
| real_cost (1 MR одобрен) | 348 600 ₽ |
| real_margin_amount | 492 900 ₽ |
| real_margin_pct | 58.57 % |
| ks2_completion_pct | 40.26 % |

Все 6 cron-задач отработали без исключений.

## ✅ Сделано (Идеи из OpenConstructionERP, 13.05.2026)

Дима установил `openconstructionerp` (AGPL-3.0, Data Driven Construction) — конкурентный open-source ERP. **Воспроизвели 4 идеи** своими силами (без копирования кода, только архитектура):

**1. defusedxml** — security-fix GS XML парсера. Защита от XXE-атак, Billion Laughs, External Entity Injection. Drop-in замена `xml.etree.ElementTree.fromstring`. Установлен в Frappe venv.

**2. Change Orders — модуль изменений scope проекта** (v1.4)
- DocType `Change Order` + `Change Order Item` (autoname `CO-.YYYY.-.#####`)
- Workflow: Черновик → На согласовании → Одобрен / Отклонён → Закрыт
- Раздельные суммы: contractor_amount / engineer_amount / approved_amount (для переговоров)
- Поля: reason_category (5 категорий), variation_type, schedule_impact_days (может быть отрицательным)
- API: `api/changeorder.py` — get_list, get_detail, save, set_status, get_stats
- Frontend: `/change-orders` с KPI-бaром (всего/одобрено/в работе/срок), фильтрами, таблицей, drawer'ами создания и просмотра, smart-меню смены статуса с полем «ФИО согласующего»
- Сайдбар: «Изменения» после КС-3

**3. Cost Catalog (Russia Pack) — справочник расценок ГЭСН**
- DocType `Cost Catalog Item`: code / section (17 разделов ГЭСН) / standard (ГЭСН/ФЕР/ТЕР) / edition / unit / base_price / work_type / region / usage_count
- API: `api/catalog.py` — get_list, fuzzy_search (через **rapidfuzz**), save_item, use_item, get_stats, seed_catalog
- **Seed-набор**: 21 базовая позиция в 6 разделах (АКЗ, металлоконструкции, кровли, трубопроводы, бетон, отделка) — реальные коды ГЭСН + цены в текущих ценах Свердловской обл.
- Frontend: `/catalog` со счётчиком разделов, debounced поиском, фильтрами, таблицей
- Custom Fields в Estimate: `estimation_method` (Ресурсный / Базисно-индексный / Ресурсно-индексный) + `regional_index` (СМР индекс Минстроя)
- Сайдбар: «Каталог» после «Сметы»

**4. EVM Forecast — прогноз стоимости проекта**
- `api/evm.py` → `get_forecast(project)`:
  - **BAC** = planned_cost (или contract × (1 - planned_margin_pct))
  - **AC** = Σ Material Request {Одобрена/Закупается/Получена}
  - **EV** = % выполнения (КС-2 подписанные / контракт) × BAC
  - **PV** = линейный прогноз по календарю start → planned_end
  - **CPI** = EV / AC, **SPI** = EV / PV
  - **EAC** = BAC / CPI, **ETC** = EAC - AC, **VAC** = BAC - EAC
  - **TCPI** = (BAC - EV) / (BAC - AC)
  - **health** = «Опережает план / В плане / Тревожный сигнал / Серьёзное отставание / Критический срыв» (по worst{CPI,SPI})
  - **warnings**: текстовые рекомендации (CPI<0.9 → перерасход, SPI<0.9 → отставание и т.д.)
- Учитывает Change Orders (approved_amount как доп. расход)
- Frontend: блок `<EVMBlock>` в карточке проекта `/projects/[name]` (таб «Обзор»): 4-KPI (BAC/AC/EAC/VAC), 3 индекса (CPI/SPI/TCPI) с цветными прогресс-барами относительно 1.0, warnings-блок
- Тест на PR-2026-0001: BAC 1.85М, AC 348.6К, EAC 865К, VAC +984К → «Опережает план» ✓

**Юридическая безопасность:** AGPL-3.0 — копилефт. Мы воспроизвели **идеи и архитектуру**, не копируя их код (как смотрим HTML-прототипы). Это легально.

## ✅ Сделано (Идеи из OpenProject, 13.05.2026)

Дима попросил изучить **OpenProject** (https://github.com/opf/openproject, GPL, Ruby/Rails PM-инструмент). Сначала субагент сделал обзор (Work Packages с гибкими relations + lag, иерархические custom fields, Custom Actions, BCF/BIM, Notification Streams). Выбрал из этого списка **2 идеи**, которые не дублируют наше и быстро дают ценность:

**1. Activity Feed — единая лента событий** (idea from OpenProject's Activity tab)
- `api/activity.py` — `get_feed(project, doctype_filter, days, limit)` и `get_summary(days)`
- Агрегирует 13 наших DocType: Tender, Estimate, KS2 Act, KS3 Act, Material Request, Change Order, Foreman Report, Safety Incident, Equipment, Interaction, Deal, Construction Project, Meeting
- Каждое событие: `{doctype, name, title, status, action, when, who, project, icon, label, href}` — готово к рендеру
- Frontend компонент `components/activity/ActivityFeed.tsx` (переиспользуется на дашборде и странице)
- Страница `/activity` — фильтры периода (1д / 7д / 14д / 30д) и типа документа (14 опций); summary-блок с топ-N по типам
- На главном дашборде — встроенный блок «За 7 дней» с топ-10 последних событий и линком «Вся лента →»
- Сайдбар: «Лента» вторым пунктом после Дашборда

**2. Meetings — планёрки с повесткой и поручениями** (idea from OpenProject's Meetings module)
- 3 DocType: `Meeting` + `Meeting Item` (child) + `Meeting Attendee` (child)
- Поля Meeting: title, status (Запланирована/Проведена/Отменена), meeting_type (7 типов), project, meeting_date, start_time, duration_min, location, agenda_notes
- Поля Meeting Item: topic, decision, responsible, due_date, status (Открыто/В работе/Выполнено/Отменено), notes
- Поля Meeting Attendee: full_name, role, company, presence (Был/Не был/Опоздал)
- `api/meeting.py` — get_list, get_detail, save, set_status, **set_item_status** (смена статуса конкретного поручения), **get_open_items** (открытые поручения со всех планёрок, с пометкой overdue и days_to_due), get_stats
- Frontend `/meetings`: 2 вкладки — «Планёрки» (список с фильтрами) и «Открытые поручения» (агрегированно с сортировкой просроченных первыми, inline-смена статуса каждого поручения)
- KPI: всего за 30д / открыто / в работе / просрочено
- Drawer создания: участники + поручения добавляются inline; drawer просмотра: смена статуса каждой строки повестки
- Тест: 1 планёрка, 3 участника, 3 поручения, агрегированный список open_items → корректно сортирует по due_date
- Сайдбар: «Планёрки» после «Сотрудники»

**Что не брали из OpenProject:**
- Work Package relations + lag → инвазивное, не сейчас
- Иерархические Custom Fields → сложно в Frappe без custom UI
- Custom Actions → у нас уже наш паттерн (smart-меню смены статуса)
- BIM/BCF → далеко от ниши (промышленный ремонт)

## ✅ Сделано (CWICR-импорт + аудит + 4 доработки, 13.05.2026)

**CWICR — открытая база ресурсов 6 670 позиций**
- DocType `Catalog Resource` (resource_code как primary key, поля: resource_name, resource_type, unit, цены min/avg/median/max, parent_collection/department/section, usage_count, regional_factor)
- ETL `api/catalog.py → import_cwicr()` загрузил все 6 670 строк из DDC CWICR (CC BY 4.0, С.-Пб): 3875 материалов, 1631 оборудование, 1096 abstract, 68 трудовых
- Страница `/resources` с фильтрами по типу, debounced search, чипами top-10 сборников (Земляные работы, Свайные, Тоннели, Дороги, АКЗ, и т.д.)
- Атрибуция указана: Boiko, A. DDC CWICR (CC BY 4.0)

**Аудит как директор стройкомпании** — выявлено 10 пробелов (5 критичных + 5 UX). План доработок по ROI. Внедрены топ-4:

**#1 — Глобальный поиск ⌘K / Ctrl+K** ⭐
- `api/search.py → search_all()` ищет по 15 DocType: тендеры, проекты, сметы, КС-2/3, заявки, change orders, отчёты прорабов, инциденты, техника, клиенты, сделки, планёрки, каталог, ресурсы
- Скоринг: точное совпадение=100, начало строки=80, начало слова=70, in-string=50
- Компонент `<GlobalSearch>` смонтирован в DashboardLayout: модалка с автофокусом, стрелки ↑↓ + Enter навигация, ESC закрытие
- Кнопка «Поиск... ⌘K» в сайдбаре
- Тест: на запрос «Старт» — 7 матчей за 6 DocType (тендер, проект, КС-2, КС-3, MR, клиент НПП Старт)

**#2 — Документы проекта** ⭐
- `api/documents.py` использует штатный Frappe File + Custom Fields `olimp_category` / `olimp_comment` (применяются через after_migrate hook)
- 10 категорий: Договор / Смета (PDF) / Чертёж / Сертификат материала / Паспорт оборудования / Фотофиксация / Акт скрытых работ / Исп. документация / Переписка / Прочее
- API: get_project_files, upload_project_file (base64), update_file_category, delete_project_file
- Компонент `<ProjectDocuments>` в новой вкладке «Документы» карточки проекта: upload-bar (категория + комментарий + кнопка выбора), чипы фильтрации по категории, список файлов с превью/скачать/удалить

**#3 — Аттестации сотрудников** ⭐
- DocType `Employee Certification` (autoname `EC-.YYYY.-.#####`): employee_name, employee_role, cert_type (19 типов: высота, электробезопасность 1-5 групп, промальп, сварка, газоопасные, огневые, медосмотр, крановщик, стропальщик и т.д.), cert_number, issuing_organization, issue_date, expiry_date, status (Действует/Истекает скоро/Просрочено/Архив), certificate_file
- `before_save` авто-вычисляет status по дням до expiry_date
- `api/certification.py` — get_list/get_stats/save/archive + **daily cron `check_certification_expiry`** (зарегистрирован в hooks.scheduler_events.daily): отправляет Telegram-сводку за 30/14/7 дней до истечения + еженедельные пинги по просроченным; во избежание спама использует поле next_reminder_sent
- Страница `/certifications`: 4 KPI-кнопки-фильтра, блок «Ближайшие истечения» (если есть), таблица со сроками и автоматическим цветом (красный=просрочено, жёлтый=≤30д), create drawer
- Сайдбар: «Аттестации» после «ОТ/ТБ»

**#4 — Печать сметы PDF + Excel**
- `api/exports.py` расширен: `estimate_pdf(name)` через wkhtmltopdf (A4 landscape, Jinja-шаблон с разделами/итогами/маржой) + `estimate_excel(name)` через openpyxl (9 колонок, мерж разделов, итоги, маржа)
- Next.js route `/api/estimates/export?name=X&format=pdf|xlsx` (binary pass-through с правильным Content-Type)
- Кнопки «Скачать PDF» (акцент) / «Скачать Excel» (success) в `EstimateDrawer.tsx`

**Юридическая безопасность:**
- DDC CWICR: CC BY 4.0 — атрибуция указана на странице /resources

**Версия: v1.7 · Аудит. Сайдбар: +Лента, +Каталог, +Ресурсы, +Изменения, +Аттестации, +Планёрки. Глобальный поиск ⌘K. TypeScript 0 ошибок.**

## ✅ Сделано (Склад + Excel-экспорт + Mobile, 13.05.2026)

**Склад — DocType + 4 типа движений**
- DocType `Stock Item` (карточка материала): item_name, item_code, category (8 типов), unit, default_warehouse, min_qty, **denormalized** current_qty / avg_price / last_price / total_value / last_movement_date, связь с `Catalog Resource` CWICR
- DocType `Stock Movement` (движение): movement_type (Приход / Расход / Перемещение / Инвентаризация), qty, unit_price, warehouse, project, material_request, supplier_name, invoice_number, responsible, **balance_after** (фиксируется в момент операции для аудита)
- Бизнес-логика в `stock_movement.py.on_update`: weighted-average pricing, авто-пересчёт current_qty в Stock Item, on_trash реверсирует движение
- `api/stock.py`: get_items (с low_stock_only фильтром), get_item_detail (с историей 30 движений), save_item, save_movement, get_stats (всего/стоимость/low_stock/by_category/recent_movements/short_items)
- Hook `on_material_request_received` в Material Request.on_update — напоминает в логе создать приход
- Страница `/stock` с 3 KPI (всего/стоимость/low_stock-кнопка), блок «⚠️ Нужно заказать», debounced search, фильтр категории, цвет красный для low-stock строк
- CreateItemDrawer + CreateMovementDrawer (с live-предпросмотром «остаток после операции»), ItemDrawer с историей движений со светофором типа операции
- Тест: грунт ВЛ-02 100→65 кг после расхода 35 на проект, эмаль ПФ-115 80 кг, средняя цена считается корректно ✓
- Сайдбар: «Склад» после «Снабжение»

**Excel-экспорт списков — универсальный**
- `api/exports.py → export_list(spec)` поддерживает 6 spec: tenders / projects / estimates / stock / certifications / ks2
- `_LIST_SPECS` — конфигурация колонок (fieldname, label, width) для каждого spec
- Автоформат: суммы как `#,##0.00`, проценты как `0.00"%"`, даты как текст по центру, qty как `#,##0.000`
- Стили: цветная шапка `D8E4FC`, freeze panes A2, рамки, Arial 10pt
- Next.js `/api/exports?spec=X` — binary pass-through
- Компонент `<ExportButton spec="..."/>` смонтирован в шапки: /tenders, /projects, /stock, /certifications
- Тест: все 6 экспортов отдают 5-6 КБ XLSX ✓

**Mobile responsiveness**
- `<meta viewport>` через Next.js Viewport export (initialScale 1, maximumScale 5)
- `globals.css`: @media (max-width: 768px) — сайдбар становится горизонтальным с скроллом, скрываются логотип/кнопка поиска/версия (доступ через nav); drawer'ы на всю ширину; гриды KPI 4/3 → 2 столбца; @media (max-width: 480px) — KPI в 1 столбец; padding страниц 32→16; таблицы font-size 12px; H1 18px; глобальный поиск 96vw
- Селекторы по `[style*=...]` (работают с inline-стилями Next.js) — без переделки страниц

**Версия: v1.8 · Склад**

## ✅ Сделано (MR→Stock + КС-6 + UI-тема, 13.05.2026)

**1. Material Request → Stock Movement (workflow закрыт)**
- `api/stock.py → preview_receipt_from_mr(mr_name)` — предпросмотр оприходования: для каждой позиции MR ищет Stock Item (exact → fuzzy ≥85% через rapidfuzz), показывает текущий остаток и тип матча («Точное», «Fuzzy», «Создаётся новый»)
- `api/stock.py → receive_material_request(mr, supplier, invoice, responsible)` — массовое оприходование: для каждой позиции (а) создаёт Stock Item если не нашёл (категория «Прочее», склад «Основной»), (б) создаёт Stock Movement Приход с привязкой material_request, project. Защита от повторного оприходования
- Хук `on_material_request_received` обновлён: при смене статуса MR → «Получена» шлёт Telegram-сводку с напоминанием нажать «Оприходовать на склад»
- Frontend: в `SupplyDrawer` блок: «✓ создано N движений» если уже оприходовано, иначе кнопка «📦 Оприходовать на склад (N позиций)» → форма supplier/invoice/responsible + предпросмотр с типом матча каждой позиции

**2. Журнал общих работ КС-6 (87-ПП РФ)**
- DocType `Work Log` (autoname `WL-.YYYY.-.#####`): title, project, status (Ведётся/Закрыт/Передан заказчику), started_date/finished_date, customer_name/customer_representative (тех.надзор), contractor_responsible (отв. производитель работ); авто-сводка `entries_count / total_workers_days / issues_count / hidden_works_count` в `before_save` родительского
- DocType `Work Log Entry` (child): entry_date, weather (8 вариантов), temperature_c, wind_ms, shift, workers_count, responsible, **works_description**, volume_done, equipment_used, materials_used, **hidden_works** (требуют акта), **has_issues** + issues_description, inspector_signed
- `api/worklog.py` — get_list, get_detail, save_log, **add_entry** (добавить запись за день не пересохраняя журнал), get_stats
- Frontend `/work-log`: список с автосводкой, drawer с 4-KPI блоком, inline-форма «добавить запись за день» (погода, T°C, бригада, описание работ, чекбоксы «скрытые работы»/«замечания»), таблица записей с цветовыми тегами
- Сайдбар: «Журнал КС-6» после ОТ/ТБ
- Тест: 3 записи, авто-сводка 22 чел.-дня, 1 замечание, 1 скрытая работа ✓

**3. UI-тоггл тёмной/светлой темы**
- `<ThemeToggle>` в сайдбаре над версией: иконка солнца/луны
- При монтировании: `localStorage["olimp-theme"]` ?? `prefers-color-scheme` системы
- При клике: `data-theme` на `<html>` + localStorage
- `globals.css` дополнен для светлой темы: затемнены акценты (`--accent #EA580C`, `--success #15803D`, `--warning #B45309`, `--danger #DC2626`) для контраста на белом + `color-scheme: light` (правильные нативные select'ы и scrollbar)
- Защита от FOUC: возвращает `null` до `mounted`

**Версия: v1.9 · КС-6**

## ✅ Сделано (Print Format КС-6, 13.05.2026)

**Печать журнала КС-6 в гос.форме (РД-11-05-2007, Ростехнадзор):**
- `print_format/kc_6_official/kc_6_official.html` — Jinja-шаблон A4 landscape: титульный лист (10 строк реквизитов: объект, стройка, адрес, заказчик, тех.надзор, подрядчик, прораб, даты, статус) + сводка + раздел 3 «Сведения о выполнении работ» (9 граф: №, дата, метеоусловия, смена/рабочих, описание работ + объём/техника/материалы, ответственное лицо, скрытые работы, замечания технадзора, подпись)
- `api/setup.py` — добавлено `КС-6 (общий журнал работ)` в `PRINT_FORMATS`, регистрируется через `setup_print_formats()`
- `api/exports.py` — `worklog_pdf(name)` через `get_pdf()` + `worklog_excel(name)` через openpyxl (9 колонок госформы, freeze panes A2, рамки, итоги по подписям в 3 колонках); `_render_html` теперь передаёт `project_address` (берётся из `Construction Project.location`); `_pdf_response` принимает `orientation` параметр
- `_LIST_SPECS["worklog"]` — Excel-выгрузка списка журналов: код, объект, статус, проект, заказчик, отв.прораб, даты, авто-сводка (записей, чел.-дней, замечаний, скрытых работ); добавлен формат `int_fields`
- Next.js: `/api/work-log/export?name=X&format=pdf|xlsx` (binary pass-through), кнопки «↓ PDF (КС-6, гос.форма)» / «↓ Excel» в шапке drawer, `<ExportButton spec="worklog">` в шапке `/work-log`
- ExportButton extended: добавлен spec `worklog`
- Тест: создан WL-2026-00001 (АКЗ РВС-1000, 2 записи: 1 — пескоструйная очистка, 2 — грунтовка ВЛ-02 со скрытыми работами и замечанием). PDF 30 КБ × 2 страницы ✓, Excel 7.3 КБ ✓, list-export 5.7 КБ ✓
- TypeScript 0 ошибок

**Версия: v2.0 · КС-6 на печать**

## ✅ Сделано (исследование DDC + 4 модуля, 13.05.2026)

**Исследование репозиториев datadrivenconstruction:**
- DDC CWICR (Apache 2.0 + CC BY 4.0) — 55 719 позиций × 85 полей, 4 готовых n8n workflow (text/photo/PDF/CAD), Qdrant snapshot RU_STPETERSBURG 1.2GB
- OpenConstructionERP (AGPL-3.0 — берём только идеи) — EVM с S-curve, Tendering bid packages + side-by-side, Punch List, PDF Markup, Monte Carlo
- DDC Skills for AI Agents (MIT) — 221 SKILL.md, бесплатная книга «Data-Driven Construction» 2-е изд. 2025
- Аудит: что у нас УЖЕ есть (CWICR импорт 6670 С-Пб, Cost Catalog 21 ГЭСН, Change Order, EVM точечный), чего НЕТ (BIM, semantic search Qdrant, коммерческие subтендеры, Punch List, S-curve, нормативная часть CWICR)

**Внедрены 4 быстрые победы (Блок A + B4):**

**A1 — Расширение Catalog Resource нормативной частью CWICR:**
- `catalog_resource.json` +5 полей: `labor_hours_per_unit` (чел.-час), `workers_count_per_unit` (звено), `machine_hours_per_unit` (маш.-час), `electricity_kwh_per_unit`, `machine_class_name`
- migrate прошёл, все 6670 строк теперь имеют нормативные слоты (пустые, ждут расширенного импорта CWICR)

**A2 — EVM Snapshot + S-curve:**
- DocType `EVM Snapshot` (project + snapshot_date + 12 метрик), autoname `EVMS-{project}-{date}`
- `api/evm.py::save_snapshot` + `save_daily_evm_snapshots` (daily cron в hooks.py) + `get_trend(project, days)`
- Next.js route `/api/evm/trend`, React-компонент `<EVMTrendChart>` в карточке проекта: SVG 600×90 с двумя линиями (CPI синяя, SPI фиолетовая), пунктир «1.0», подписи ΔCPI/ΔSPI и диапазон дат
- Тест: первый снимок создан для PR-2026-0001, get_trend отдаёт корректную series

**A3 — Daily-report Telegram сводка (09:00):**
- `tasks.send_daily_director_digest()` — 5 разделов: горящие тендеры (≤3д), красные EVM (warning/critical/disaster), просроченные поручения с планёрок (Meeting Item.due_date < today), истекающие аттестации (≤30д), застрявшие Material Request (status=Закупается, создано >14д назад)
- 5 helper-функций `_collect_*` с try/except + frappe.logger().warning
- Защита от отсутствующих DocType через `frappe.db.exists("DocType", ...)`
- Telegram HTML-форматирование (НЕ markdown — урок 2026-05-13)
- Cron `"0 9 * * *"` в hooks.scheduler_events.cron, существующий AI engine `"0 * * * *"` сохранён
- Тест: curl POST → `{ok:true, empty:true, sent:true, counts:{...}}` (на тестовых данных пусто → «✓ Утро тихое»)

**B4 — Punch List (список недоделок к сдаче):**
- DocType `Punch List Item` (autoname `PL-{YYYY}-{#####}`): title, project, item_type (5 типов: Дефект/Доделка/Замечание заказчика/Корректировка проекта/Подготовка к сдаче), urgency (4 уровня), status (5 статусов), location, assignee, reported_by/date, due_date, completed_date (авто), photo_before/after (Attach Image), cost_estimate, next_reminder_sent
- `before_save` (на ПАРЕНТЕ — child-before_save ненадёжен): авто-completed_date при статусе «Выполнено»
- `api/punchlist.py`: get_list / get_detail / get_stats / save_item / set_status / get_overdue
- Daily cron `check_punch_list_overdue` — Telegram директору раз в неделю про просроченные доделки
- Frontend `/punch-list`: 5 KPI-кнопок-фильтров (всего / открыто / в работе / просрочено красная / критично оранжевая), debounce-поиск 300мс, селекты project/urgency/item_type, таблица с цветовыми тегами, drawer создания + drawer детали с upload фото до/после (base64) и сменой статуса
- Sidebar: «Доделки» после «Журнал КС-6»
- Тест: создан PL-2026-00003, get_stats отдаёт корректные счётчики
- **Новый подводный камень** (записан в CLAUDE.md р.18, см. ниже): `frappe.get_all(order_by=...)` не принимает `CASE WHEN`/`FIELD()` — для кастомной сортировки нужен `frappe.db.sql`; после правки api-модуля нужен `docker restart olimp_backend` (gunicorn кэширует модули, `bench clear-cache` не сбрасывает)

**Все проверки прошли:** TypeScript 0 ошибок · bench migrate OK · 3 endpoint-а отвечают корректно (punchlist.get_stats, send_daily_director_digest, evm.get_trend).

**Версия: v2.1 · DDC-импульс**

## ✅ Сделано (Субподряд + Infra-fix, 13–14.05.2026)

**Модуль «Субподряд» (Блок C из DDC) — полностью закрыт:**
- 4 DocType: `Subcontract Bid Request` / `Bid Item` (autoname `BR-{YYYY}-{#####}`) + `Subcontract Proposal` / `Proposal Item` (`SP-{YYYY}-{#####}`)
- Авторасчёт в `before_save` родителей: `total_target_amount`, `total_amount`, `vs_target_pct`, `best_proposal_amount`, `savings_amount`, `savings_pct`, snapshot `supplier_name_snapshot` (защита от переименований Supplier), `on_update` Proposal триггерит пересчёт сводок в BR
- `api/subcontract.py` 8 endpoints: `get_list / get_stats / get_detail` (с вложенными proposals), `save_bid_request`, `create_from_estimate` (pre-fill из сметы), `save_proposal` (+ Telegram директору о новом КП), `compare_proposals` (side-by-side: строки Bid Item × колонки Proposals + метка `cheapest_proposal` на самом дешёвом), `set_winner` (присуждение: победитель → «Выбрано», остальные → «Отклонено»)
- Frontend: `/subcontract-bids` со списком + 4 KPI (Всего / Активные / Присуждено / Экономия суммарно), фильтры, цветовые статусы, ярлыки «просрочено N д»; `<SubcontractBidDrawer>` с inline-таблицей позиций (live-расчёт суммы); `<ProposalComparisonView>` модалка side-by-side с зелёной подсветкой самого дешёвого по строке и кнопкой «Выбрать» в каждой колонке; вложенный `<AddProposalDrawer>` с автокомплитом подрядчика (через `/api/suppliers` → `frappe.client.get_list`)
- Сайдбар: «Субподряд» после «Снабжение»
- Тест: BR-2026-00004 «АКЗ резервуара РВС-2000» 1.06 млн ₽ + 2 КП (88.8% и 99.2%) → экономия 119 000 ₽ (11.2%)

**Infra-fix (3 критичных бага после ребута WSL — записаны в CLAUDE.md р.18):**
1. `docker-compose.yml` сервис `backend` теперь имеет явный `command:` со всей строкой gunicorn — без этого `docker compose up -d` пересоздавал контейнер без CMD → крэш-loop → 502 везде
2. `sites/apps.txt` + `apps.json` дополнены `olimp_construction` — без этого все `frappe.get_doc(...)` падали с «Модуль Olimp Construction не найден» (карточки проектов/смет/тендеров не открывались)
3. `api/project.get_detail` — для `Material Request` указан явный префикс таблицы в `order_by` (`` `tabMaterial Request`.modified ``), иначе SQL падал с `Column 'modified' is ambiguous`
- Smoke: 24/24 backend endpoint + 20/20 frontend страниц зелёные

**Версия v3.2 · Subcontract + Infra-fix**

## ✅ Сделано (Gantt + Риски + Semantic Search, 14.05.2026)

Три новых модуля закрыты одной сессией (frontend + backend + DocType + миграция):

**1. Графики работ (Gantt) — Фаза 5 (частично):**
- DocType `Schedule Task` (autoname `ST-{YYYY}-{#####}`): title, project, parent_task (для разделов), is_section, is_critical, status (Запланирована/В работе/Выполнена/Отменена), start_date, end_date, duration_days (read_only, авто), progress, assignee, subcontractor, order_idx, predecessor, estimate_item_link, notes
- `before_save` авто: `duration_days = end-start+1`; progress≥100 → статус «Выполнена»; progress 0<x<100 при «Запланирована» → «В работе»; запрет self-parent
- `api/schedule.py` 6 endpoints: `get_tasks(project)` с авто-сводкой разделов (min start/max end по детям + weighted progress по длительности), `get_summary` (total/planned/in_progress/done/overdue/critical_count/avg_progress), `save_task`, `delete_task` (detach детей), `set_progress`, `set_dates` (drag-and-drop)
- Frontend `/schedule` — список проектов (активные/прочие); `/schedule/[project]` — Gantt-диаграмма
- `<GanttChart>` 336 строк: timeline по дням (DAY_PX=28), шапка-месяцы + дни, линия «сегодня», выходные затемнены; критический путь — красная подсветка с меткой «КП»; разделы — отдельный фон, прогресс рассчитывается агрегированно; цвета баров по статусу (done/inWork/planned/critical)
- `<TaskDrawer>` — создание/правка задачи (тип «задача»/«раздел», даты, исполнитель, КП, прогресс)
- Сайдбар: «Графики»
- Тест: 12 задач в БД, 6 на критическом пути, 1 в работе, средний прогресс 20%

**2. Реестр рисков (Project Risk):**
- DocType `Project Risk` (autoname `RISK-{YYYY}-{#####}`): title, project, category (9 типов: Финансовый/Технический/Срочный/Качество/Безопасность/Регуляторный/Поставщик/Заказчик/Погодный), status (Открыт/В работе/Снижен/Закрыт/Реализовался), owner_full_name, detected_date, target_resolution_date, **probability** 1-5, **impact** 1-5, risk_score (read_only = P×I), impact_amount, **contingency_amount** (read_only, ожидаемая стоимость = impact × probability/5), response_strategy (Принять/Снизить/Передать/Избежать), mitigation_plan, trigger_events, actual_outcome, linked_estimate (Estimate), notes
- `api/risks.py` 6 endpoints: get_list (с фильтрами + сортировка по score DESC), get_summary (KPI + распределение по зонам: красная ≥15, жёлтая 8-14, зелёная <8), get_matrix (5×5 — каждая ячейка с count + items для рендера тепловой карты), save_risk, delete_risk, **apply_to_estimate** (добавляет позицию `RISK-{name}` с contingency_amount в выбранную смету + проставляет linked_estimate)
- Frontend `/risks`: KPI-бар, фильтры project/category/status/min_score, таблица с цветными зонами; `<RiskDrawer>` создание/правка с live-расчётом контингенции; `<RiskMatrix>` — модалка-сетка 5×5 (probability × impact), цвет ячейки по score, клик показывает риски в ячейке
- Сайдбар: «Риски»
- Тест: 8 рисков в БД, 1 в красной зоне, 6 в жёлтой, 1 в зелёной, суммарная контингенция 1.484М ₽

**3. Семантический поиск каталога ресурсов (Qdrant + OpenAI):**
- Новый модуль `ai_services/` — `qdrant_client.py` (обёртка `olimp_catalog` коллекции, 1536-dim, Cosine) + `embeddings.py` (`text-embedding-3-small`, batch до 1024)
- `api/semantic_search.py` 3 endpoints: `get_status` (статистика индекса + total_in_db), `reindex_catalog(reset=0, batch_size=96)` — батчевая индексация всех 6670 Catalog Resource (1 ресурс ≈ 15 токенов → ~$0.002 на весь каталог), `search(query, limit, category?, resource_type?)` — vector search с фильтрами
- Text для embedding: `resource_name · parent_category · parent_collection · resource_type`
- Frontend `<AISearchModal>` (231 строк): ⌘K-подобная модалка, debounced поиск, отображение score 0-1, кнопка «выбрать» (передаёт `SemanticHit` через `onPick`); подключён в `/resources` (просмотр) и `EstimateDrawer` (выбор → автофилл позиции)
- API routes: `GET /api/semantic-search?query=...`, `GET /api/semantic-search/status`, `POST /api/semantic-search/reindex`
- `requirements.txt`: `qdrant-client>=1.7.0`, `openai>=1.50.0`
- `docker-compose.yml`: `OPENAI_API_KEY` + `QDRANT_URL=http://qdrant:6333` переданы в backend
- ⚠️ **Нужно пополнить OpenAI** — ключ пустой в .env, до его установки индексация недоступна. После: один POST на `/api/semantic-search/reindex` (1 минута, ~$0.002), Qdrant поднимет коллекцию автоматически

**Все проверки:** TypeScript 0 ошибок · `bench migrate` OK · 5 endpoints отвечают (schedule.get_summary, risks.get_summary, semantic_search.get_status, subcontract.get_stats, punchlist.get_stats)

**Версия v3.3 · Gantt + Риски + Semantic**

## ✅ Сделано (v3.4 — post-аудит fixes, 14.05.2026)

После 3 параллельных subagent-аудитов (Schedule / Risks / Semantic Search) — 80+ замечаний, 7 ключевых пофикшено:

1. **`risks.apply_to_estimate` идемпотентность** — повторный вызов обновляет существующую строку RISK-{name}, не создаёт дубль + теперь заполняется `base_unit_price` (раньше `margin_pct` искажался)
2. **`save_risk` / `save_task` permission order** — `has_permission(create)` перенесено ПОСЛЕ определения операции; роли с write=1, create=0 теперь могут апдейтить
3. **`Schedule Task.validate`** — throw если `end_date < start_date`
4. **`Schedule Task.before_save`** — статус возвращается в «Запланирована» при `progress=0` (раньше залипал в «В работе»)
5. **`Project Risk.validate`** — throw на отрицательный `impact_amount`
6. **`_parse_level`** (Python + TS) — поддержка обычного дефиса `-` и `—` (раньше падал на обычном → score=0 → риск исчезал)
7. **`semantic_search.reindex_catalog`** — только System Manager + clamp limit ∈ [1..50]
8. **RiskDrawer** — добавлено поле notes (раньше нередактируемо)

3 новых записи в CLAUDE.md §18: __pycache__ после ребута WSL, apply_to_estimate дубль, permission order.

**Коммит:** d08f57b

## ✅ Сделано (v3.5 — AI-декомпозиция работы, 14.05.2026)

Главная фича сессии: **пишешь «усиление плиты углеволокном 120 м²» — система раскладывает на 9 этапов с объёмами и нормами**.

Архитектура hybrid (templates + AI fallback):
- DocType `Work Template` + `Work Stage Template` (child table)
- `api/ai/decompose_work.py`: keyword-match шаблонов → fallback на Claude Haiku если нет шаблона
- `api/ai/seed_work_templates.py`: seed 5 базовых шаблонов под профиль ОЛИМП (АКЗ РВС / CFRP / огнезащита / монтаж м/к / промальп)
- Frontend `<DecomposeWorkModal>` 250 строк: input → предпросмотр этапов с бейджем ШАБЛОН/AI → кнопка «✓ Добавить в смету»
- Кнопка «🪄 AI-смета» в шапке EstimateDrawer
- Next.js route `/api/estimates/decompose`

Смок-тест: 3 кейса (АКЗ РВС-2000 1800м² → 1305 чел.-час · огнезащита R90 350м² → 251 чел.-час · видеонаблюдение → AI fallback → корректная ошибка о пустом балансе).

**Коммит:** c4dc78f

## ✅ Сделано (v3.6 — 5 улучшений decompose, 14.05.2026)

После проверки концепции — все 5 запланированных улучшений в одном коммите:

1. **Расширение seed**: 5 → 20 шаблонов в 10 категориях (АКЗ x3, огнезащита x2, усиление x2, монтаж м/к x2, промальп x2, кровля x2, полы x2, бетон, демонтаж, прочее x3)
2. **Qdrant semantic search**: универсальные `ensure_collection / upsert_points / search_collection` в `ai_services/qdrant_client.py` + коллекция `olimp_work_templates` + `api/ai/work_templates_index.py` (get_status / reindex / search). decompose_work сначала спрашивает Qdrant (если score≥0.45), fallback на keyword. Без OPENAI_API_KEY работает на keyword.
3. **Modular Chain-of-Thought** (preprints.org Oct 2025): 3 шага вместо одного — classify → extract → decompose. Снижает галлюцинации в 3-5×. Функция `_ai_decompose_cot`.
4. **Stages → Catalog Resource** (автоцена): если этап шаблона привязан к `catalog_resource`, в декомпозицию приходит `unit_price + amount`. При применении в смету: `base_unit_price = price_avg`, `our_unit_price = base × 1.15` (стандартная 15% наценка).
5. **Decomposition Feedback**: новый DocType (description, template_used, source, was_applied, was_edited_after, rating 👍/👌/👎, decomposition_json, user_diff_json). Автосохранение в decompose_work. Endpoint `rate_feedback`. После «Добавить в смету» открывается экран с 3 кнопками оценки.

**Коммит:** 13b517b

## ✅ Сделано (v3.7 — расширения AI-декомпозиции, 14.05.2026)

Все 5 продолжений:

1. **Auto-link CWICR (экспериментально)**: `api/ai/autolink_resources.py` через rapidfuzz. ⚠️ Прямой match названий этапов на CWICR-ресурсы даёт мусорные привязки (этапы=работы, CWICR=ресурсы). Оставлено как helper, рекомендуется ручная привязка в админке.
2. **Расширение шаблонов (20 → 47)**: +27 шаблонов в `seed_work_templates_ext.py` (земляные, фундаменты, кладка, гидроизоляция, утепление, перегородки, штукатурка, окраска, полы, окна-двери, инженерные сети, скатные кровли, химанкеры, инъекция трещин)
3. **Дашборд `/decomposition-stats`**: 8 KPI (всего, шаблон vs AI, CSAT, оценки), топ-10 шаблонов по good/bad, запросы без шаблона (нужно создать), активность пользователей, лента событий. Пункт «Аналитика AI» в сайдбаре.
4. **Track estimate edits**: `track_diff(feedback_id, current_items)` вычисляет added/removed/modified строк сметы относительно AI-генерации. Сохраняется в Decomposition Feedback.user_diff_json.
5. **Auto-suggest new template** (cron weekly): `analyze_clusters` группирует похожие запросы без шаблона (rapidfuzz token_sort_ratio≥75%), кластер ≥3 → создаёт черновик через `create_template_from_cluster` (is_verified=0, требует верификации). Cron weekly: `suggest_templates` пишет сводку в Error Log.

Smoke-test: 47 шаблонов · 11 категорий · TypeScript 0 ошибок · все endpoints отвечают.

**Коммит:** a859c38 · **Версия v3.7**

## ✅ Сделано (v3.8 — Webhook для лидов с сайта, 14.05.2026)

- `api/webhook/leads.py::create_lead` (allow_guest=True, POST)
- Принимает: name/phone/email/company/subject/description/source/utm_*
- Honeypot + опц. WEBHOOK_LEAD_SECRET
- Telegram-уведомление директору на каждый новый лид
- Frontend: `<LeadFormHTML>` готовая форма с UTM из URL
- Готовый шаблон `scripts/webhook-examples/lead-form.html` для встраивания на сайт

**Коммит:** e97fdd5

## ✅ Сделано (v3.9 — UI редактор Work Template, 14.05.2026)

Раньше 47 шаблонов редактировались только в админке Frappe. Теперь:
- /work-templates — список + KPI + категории-чипы + фильтры
- WorkTemplateDrawer 390 строк — inline-таблица этапов с ↑↓× кнопками
- Полный CRUD: create/update/delete/duplicate
- `api/ai/work_templates.py` — 6 endpoints (get_list/detail/save/delete/duplicate/get_categories)

**Коммит:** e3edb7c

## ✅ Сделано (v4.0 — Telegram-бот для лидов + Stage Resource split + PDF Markup, 14.05.2026)

3 параллельных модуля:
1. **Telegram-бот заявок**: n8n/workflows/telegram-lead-bot.json + README. Бот @OlimpZayavka_bot
2. **Stage Resource split**: новый DocType Work Stage Resource (material / labor / equipment раздельно к CWICR)
3. **PDF Markup MVP**: DocType PDF Annotation + страница /pdf-annotations + viewer через native <embed> + overlay аннотаций (4 инструмента: 📝/▢/✓/✍️)

**Коммит:** c552147

## ✅ Сделано (v4.1 — Apply Template + Leads Stats + Bulk Import, 14.05.2026)

3 практичных фичи:
1. **Apply Template → Estimate**: кнопка 🪄 на /work-templates → модалка → этапы добавляются в смету с автоценой и наценкой
2. **/leads-stats**: дашборд с 7 KPI + воронка + источники с конверсией + timeline + последние лиды
3. **/clients/import**: CSV bulk-import с dry-run и валидацией

**Коммит:** 10e82c3

## ✅ Сделано (v4.2 — CWICR импорт нормативной части, 14.05.2026)

- `api/ai/cwicr_import.py::import_from_parquet`
- Импортировал 1631 machine_class_name из RU_SPB.parquet (раньше 0)
- pyarrow + pandas установлены в Frappe venv, в requirements.txt

**Коммит:** 1cbf3ae

## ✅ Сделано (v4.3 — CWICR full import: 55 719 расценок, 14.05.2026)

ГЛАВНОЕ ЗА СЕССИЮ — импортировал 55 719 типовых работ из CWICR:
- DocType `Catalog Work Item` (autoname=rate_code)
- Bulk SQL INSERT IGNORE батчами 5K (30 сек на 55K)
- Иерархия: category → department → section → subsection
- 5 категорий: СТРОИТЕЛЬНЫЕ (29К), МОНТАЖ ОБОРУДОВАНИЯ (19К), РЕМОНТНО-СТРОИТЕЛЬНЫЕ (4К), ПУСКОНАЛАДОЧНЫЕ (2.6К), КАПИТАЛЬНЫЙ РЕМОНТ (425)
- Страница /catalog-work-items с фильтрами/поиском/drawer'ом с полным составом работ

**Коммит:** 276dc23

## ✅ Сделано (v4.4 — связь CWICR ↔ сметы/шаблоны + глобальный поиск, 14.05.2026)

- **«➕ В смету»**: add_to_estimate(rate_code, estimate, qty, base_price) → строка в Estimate
- **«📋 Создать шаблон»**: convert_to_work_template — парсит work_composition_text regex'ом на этапы, создаёт Work Template (черновик)
- Глобальный поиск (Ctrl+K) расширен на Catalog Work Item (55K) и Work Template (47)

**Коммит:** 4321c77

## ✅ Сделано (v4.5 — HubSpot/Pipedrive/Procore подсос, 14.05.2026)

После разведки 4 субагентами (Procore, Linear/Notion, HubSpot/Pipedrive, PlanRadar/Fieldwire) — получил 28 идей. Внедрил топ-5:
1. **Pipeline Rotting**: автоподсветка зависших сделок (>N дней без активности по стадии)
2. **Win/Loss Reasons + Analysis**: loss_reason обязателен при «Закрыт проигран»; топ-причины + win-rate по источникам
3. **Deal Forecasting**: weighted_total = sum(amount × probability/100), commit (≥80%), best_case, by_month
4. **Ball-in-Court для Change Orders**: current_responsible + days_with_current + auto-handoff
5. **Saved Views** (backend): DocType User View + CRUD API

**Коммит:** 6b100e0

## ✅ Сделано (v4.6 — Lead Scoring + DaData + Activity Timeline + UX, 14.05.2026)

4 фичи из 23 отложенных:
1. **Lead Scoring**: rule-based 7 правил → Grade A/B/C/D + auto-update в before_save Deal
2. **DaData ИНН enrichment**: lookup_by_inn / lookup_and_apply_to_customer
3. **Activity Timeline** (backend): get_timeline собирает Version + Comment + Communication
4. **UX-серия**: `<Skeleton>`, `<SkeletonTable>`, `<EmptyState>`, `<ToastProvider>` + useToast()

**Коммит:** 7733dfd

## ✅ Сделано (v4.7 — ЕГРЮЛ lookup без регистрации, 14.05.2026)

DaData не активирован у Димы (Suggestions disabled). Сделал fallback:
- `egrul.itsoft.ru` — публичный API без регистрации
- Парсер ФНС-структуры (СвЮЛ/СвНаимЮЛ/СвАдресЮЛ/СведДолжнФЛ)
- /clients/inn-lookup — страница с быстрой формой поиска
- При наличии DADATA_API_KEY — пробует DaData первой; иначе сразу ЕГРЮЛ

**Коммит:** 8c5f1b4 · **Версия v4.7 · Версия с DaData ИНН лукапом**

## 📋 Следующие задачи

**Блок B (средние):**
- [ ] **PDF Markup** — react-pdf-annotator для актирования + сохранение разметки в JSON
- [ ] **Webhook /api/leads** — приём заявок с сайта в Deal (без AI, можно сразу)
- [ ] **Telegram-бот "оценка по описанию"** — текст → Claude Haiku → черновик сметы (требует пополнить Anthropic)
- [ ] **Работа со шаблонами в Next.js UI** — сейчас Work Template редактируется только в админке Frappe

**Блок C (большие):**
- [x] ~~Subcontractor Bid Request / Proposal~~ — ✅ закрыт 14.05.2026
- [x] ~~Semantic search через Qdrant + OpenAI embeddings~~ — ✅ закрыт 14.05.2026 (нужно пополнить OpenAI чтобы запустить reindex)
- [x] ~~AI-декомпозиция работы → этапы сметы (47 шаблонов)~~ — ✅ закрыт 14.05.2026
- [ ] **Полный CWICR импорт 55K** — загрузить snapshot С-Петербург (1.2GB) или расширить до всех регионов
- [ ] **Фото→смета** (n8n_2 адаптация) — Claude Vision определяет работы по фото объекта
- [ ] **Разделить stage.resources** — модель этапа: материалы (Material → CWICR) + труд (Labor → CWICR), вместо одного catalog_resource

**Блок D (опциональное):**
- [ ] **AI-Assistant запуск (Фаза 7)** — после пополнения Anthropic
- [ ] **Графики работ (Gantt)** — Фаза 5, есть HTML-прототип 05_gantt_schedule.html
- [ ] **Пополнить баланс Anthropic** → AI-ассистент заработает автоматически
- [ ] **Импорт базы реальных клиентов** из старой системы
- [ ] **Активировать TenderGuru n8n workflow** после первого ручного теста API

---

## 📝 Заметки

### Сессия 10 — 14.05.2026 (вечер)
**Что сделано:**
- v3.4: post-аудит fixes (8 пунктов) — apply_to_estimate идемпотентность, permission order, валидация дат, _parse_level любой дефис, защита reindex_catalog, поле notes в RiskDrawer
- v3.5: AI-декомпозиция работ → этапы сметы (DocType Work Template + Stage, 5 базовых шаблонов, кнопка 🪄 AI-смета в EstimateDrawer)
- v3.6: 5 улучшений (Qdrant search, Modular CoT, автоцена из CWICR, Decomposition Feedback, экран оценки 👍/👌/👎)
- v3.7: расширение до 47 шаблонов, дашборд /decomposition-stats, track_diff, auto-suggest new template
- 3 новых подводных камня в CLAUDE.md §18

**Текущий стек:**
- 47 Work Templates в 11 категориях
- Decomposition Feedback с track_diff
- Аналитика AI на /decomposition-stats
- Cron weekly: suggest_templates

**Блокеры:** ANTHROPIC_API_KEY и OPENAI_API_KEY пусты в .env → AI fallback / Qdrant reindex недоступны.

### Сессия 9 — 14.05.2026
**Что сделано:**
- Завершены 3 модуля (без коммита со вчера): Gantt-графики, Реестр рисков, Семантический поиск Qdrant
- Smoke-тест 5 endpoint: все зелёные (schedule: 12 задач/6 КП, risks: 8 рисков/1 красная зона, semantic: 6670 в БД, subcontract: 1+2, punchlist: 1)
- TypeScript: 0 ошибок · OPENAI_API_KEY всё ещё пустой — нужно пополнить чтобы запустить reindex_catalog

### Сессия 7 — 11.05.2026
**Что сделано:**
- Фаза 9: Командный центр `/dashboard` — агрегатор всех 8 модулей, алерты, авто-рефреш
- Сайдбар «Дашборд» как первый пункт, root redirect → `/dashboard`
- TypeScript: 0 ошибок; API-тест: данные корректны ✓

### Сессия 6 — 11.05.2026
**Что сделано:**
- Фаза 7: SSE-стриминг через Claude Haiku, контекст из всех модулей, полноценный чат-UI
- TypeScript: 0 ошибок; стриминг работает, нужно пополнить баланс Anthropic

### Сессия 5 — 11.05.2026
**Что сделано:**
- Фаза 6: DocType Foreman Report + Safety Incident, API, страница /safety с двумя drawer
- TypeScript: 0 ошибок, тест FR-2026-00001 + SI-2026-00001 ✓

### Сессия 4 — 11.05.2026
**Что сделано:**
- Фаза 5 (Cashflow): backend + frontend, прогноз 3 мес, inline-редактирование баланса
- TypeScript: 0 ошибок

### Сессия 3 — 11.05.2026
**Что сделано:**
- Portal-аудит: найдены и исправлены 3 бага (PATCH 417, статус mismatch, XML-импорт)
- TypeScript: 0 ошибок после всех изменений
- Backend: set_status endpoint + estimate.py import_from_gs_xml patch

### Сессия 2 — 10.05.2026
**Что сделано:**
- Исправлена авторизация Frappe API: создан server-side proxy route в Next.js
- Frontend `.env.local` с FRAPPE_API_KEY/SECRET
- Telegram helper и cron-задача по дедлайнам
- CURRENT_TASK.md обновлён до актуального состояния

**Dev-сервер Next.js:**
```bash
# Запуск (нужен Linux node из nvm):
cd ~/Projects/olimp-erp/frontend
PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" npm run dev > /tmp/nextjs.log 2>&1 &
```

---

## 🔗 Ссылки

- [CLAUDE.md](./CLAUDE.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [MVP_ROADMAP_v3.md](./MVP_ROADMAP_v3.md)
- [SCHEMA_v5.md](./SCHEMA_v5.md)
- [prototypes/03_tenders_pipeline_v2.html](./prototypes/03_tenders_pipeline_v2.html) — дизайн-референс
