# OLIMP.STACK

> Полнофункциональная система управления строительной компанией:
> **ERPNext** (бэк-офис) + **OpenConstructionERP** (preconstruction)
> + **Twenty CRM** + **n8n** + **MinIO**
>
> Спроектирована для ООО «Олимп» (Екатеринбург, промышленное строительство,
> оборот ~120 млн ₽/год).

---

## Что внутри

```
olimp-stack/
├── README.md                          ← ты здесь
├── docker-compose.olimp.yml           ← compose-надстройка для OCE
├── .env.olimp.example                 ← переменные окружения
│
├── docs/
│   ├── 01-architecture.md             ← целевая архитектура и потоки данных
│   ├── 02-model-mapping.md            ← маппинг OCE-сущностей на ERPNext DocType
│   ├── 03-agpl-risks.md               ← юридический разбор AGPL-3.0
│   ├── 04-boq-example-ntmk.md         ← пример BOQ на реальном объекте НТМК
│   └── 05-implementation-roadmap.md   ← план внедрения по неделям
│
├── n8n-workflows/
│   ├── 01-boq-to-erpnext-project.json ← BOQ Won → создать Project + Tasks + MR
│   └── 02-actuals-to-evm.json         ← Ночная синхронизация факта → EVM
│
├── erpnext-doctypes/
│   ├── boq.json                       ← Главная сущность BOQ
│   ├── boq-section.json               ← Child: разделы
│   ├── boq-position.json              ← Child: позиции
│   ├── construction-assembly.json     ← Типовые сборки работ
│   ├── assembly-item.json             ← Child: состав сборки
│   ├── project-change-order.json      ← Допсоглашения
│   └── project-risk.json              ← Реестр рисков
│
└── scripts/
    ├── Caddyfile.oce                  ← TLS для estimate.olimp-ural.ru
    ├── oce-postgres-init.sql          ← Инициализация Postgres
    └── import-doctypes.sh             ← Импорт DocType в ERPNext
```

---

## Быстрый старт (за 30 минут)

### 1. Подготовка (5 минут)

```bash
# Клонируй и положи рядом с основным docker-compose ERPNext
cd /opt/olimp/
git clone <your-fork> olimp-stack
cd olimp-stack

# Заполни переменные окружения
cp .env.olimp.example .env.olimp
nano .env.olimp                      # заменить все ChangeMe_*

# Создай сеть, если ещё нет
docker network create olimp_network 2>/dev/null || true
```

### 2. Запуск OCE (10 минут)

```bash
# Из директории, где лежит основной docker-compose.yml ERPNext
cd /opt/olimp/

docker compose \
  -f docker-compose.yml \
  -f olimp-stack/docker-compose.olimp.yml \
  up -d

# Проверка
docker compose logs -f oce-backend     # дождись "Application startup complete"
curl https://estimate.olimp-ural.ru/api/health
```

### 3. Импорт DocType в ERPNext (5 минут)

```bash
# Скопировать DocType-файлы внутрь контейнера ERPNext и запустить импорт
docker compose exec erpnext-backend bash
cd /home/frappe/frappe-bench
bash /path/to/olimp-stack/scripts/import-doctypes.sh
```

### 4. Импорт n8n workflows (5 минут)

```
1. Открой https://n8n.olimp-ural.ru
2. Settings → Import from File
3. Загрузить olimp-stack/n8n-workflows/01-boq-to-erpnext-project.json
4. Загрузить olimp-stack/n8n-workflows/02-actuals-to-evm.json
5. Создать credentials: ERPNext API Token, OCE API Token
6. Активировать оба workflow
```

### 5. Первая смета (5 минут)

```
1. https://estimate.olimp-ural.ru — открыть OCE
2. New Project → название "TEST-PP-R-RUBIS" (на простом объекте)
3. Загрузить ТЗ → сгенерировать BOQ через AI Cost Advisor
4. Проверить расценки → подкрутить под рынок УрФО
5. Status: Draft → Submitted → Won
6. Проверить, что в ERPNext появился Project с правильным бюджетом
7. Проверить, что прилетело Telegram-уведомление
```

---

## Что ты получаешь

### Сокращение времени на смету

| Этап | Сейчас (Excel + Гранд) | В OLIMP.STACK | Экономия |
|------|----------------------|-------|----------|
| Чтение РД, обмеры | 2-3 часа | 10 минут | ~150 мин |
| Создание позиций | 1-2 часа | 5 минут | ~100 мин |
| Расценки | 2-3 часа | 30 минут | ~120 мин |
| Ресурсная разбивка | 1 час | автоматически | ~60 мин |
| Наценки и итог | 30 минут | мгновенно | ~30 мин |
| Экспорт КП | 30 минут | 20 секунд | ~30 мин |
| **Итого на смету** | **~8 часов** | **~45 минут** | **~7 часов** |

При 3-4 сметах в неделю → **~25 часов в неделю** возвращается.
При 3000 ₽/час твоего времени → **~300 тыс ₽/мес** экономии.

### Контроль над объектами

- **EVM-метрики** каждый вечер в Telegram: SPI / CPI / EAC по всем активным
- **Алерты** при превышении бюджета >5% — узнаёшь до того, как прораб успел "проспать" расход
- **Single source of truth**: смета → проект → факт → EVM, без разрывов

### Защита знаний компании

- Сборки и историческая база цен живут в системе, не в Excel-файле сметчика
- Если сметчик уволится — его ноу-хау остаётся
- Версионирование BOQ — видна вся история правок

---

## Что НЕ входит в стек (и почему)

| Не включено | Причина | Альтернатива |
|-------------|---------|--------------|
| Гранд-Смета | проприетарный софт под Минстрой | оставляем для официалки, OCE — для коммерции |
| Полный BIM (RVT) | объёмы Олимпа не требуют | PDF-такеофф достаточно |
| CWICR база 55K | западные регионы | импорт из Гранд-Сметы (ГЭСН/ФЕР УрФО) |
| 1С | проприетарный | через интеграцию с ERPNext (отдельная задача) |
| Электронный документооборот | Диадок/СБИС снаружи | n8n workflow для отправки актов |

---

## Дорожная карта

См. `docs/05-implementation-roadmap.md`. Краткий план:

- **Неделя 1-2:** Развёртывание OCE + базовая настройка
- **Неделя 3:** Загрузка справочников, расценок, сборок
- **Неделя 4:** Первая реальная смета параллельно с Гранд-Сметой
- **Неделя 5-6:** Интеграция с ERPNext через n8n
- **Неделя 7:** Обучение команды
- **Месяц 2-3:** EVM-дашборд, Tendering, Change Orders в production
- **Месяц 6:** SSO, мобильное приложение для прорабов, OCR накладных

---

## Поддержка

- **Документация OCE:** https://openconstructionerp.com/docs
- **Документация ERPNext:** https://docs.frappe.io/erpnext
- **Документация n8n:** https://docs.n8n.io
- **Twenty CRM:** https://twenty.com/developers
- **Сообщество ERPNext (русский):** https://t.me/erpnext_ru

---

## Лицензия

- **Этот репозиторий (твои конфиги, документы, workflows, DocType):** MIT (или твоя)
- **ERPNext:** GPLv3
- **OpenConstructionERP:** AGPL-3.0 (см. `docs/03-agpl-risks.md`)
- **Twenty CRM:** AGPL-3.0
- **n8n:** Sustainable Use License (free для self-hosted)

См. `docs/03-agpl-risks.md` для разбора лицензионных вопросов в твоей модели бизнеса.

---

## Контакты

- **Владелец:** Дмитрий Игоревич Клочков, директор ООО «Олимп»
- **Email:** info@olimp-ural.ru
- **Адрес:** Екатеринбург, ул. Куйбышева 159а, оф. 19
- **Сайт компании:** https://olimp-ural.ru
