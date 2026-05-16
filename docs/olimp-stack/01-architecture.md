# Архитектура OLIMP.STACK

> Целевая архитектура: ERPNext (бэк-офис) + OpenConstructionERP (preconstruction)
> + Twenty CRM + n8n (шина) + MinIO + Telegram

## 1. Принцип разделения слоёв

```
┌──────────────────────────────────────────────────────────────────┐
│  SALES / PRESALES LAYER (Twenty CRM)                              │
│  Лиды, контакты, КП заказчику, история переписки                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ выиграли тендер → создать BOQ
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  PRECONSTRUCTION LAYER (OpenConstructionERP / OLIMP.СМЕТА)        │
│                                                                   │
│  • Загрузка ТЗ/РД (PDF, DWG, IFC, Excel)                          │
│  • PDF/CAD такеофф с калиброванной шкалой                         │
│  • BOQ-редактор (секции/позиции/ресурсы/наценки)                  │
│  • AI Cost Advisor (Claude + LanceDB по базе исполненных смет)    │
│  • Tendering модуль (сравнение КП от субподрядчиков)              │
│  • 4D Gantt с зависимостями FS/FF/SS/SF и critical path           │
│  • Risk register + Monte Carlo                                    │
│  • Change orders с импакт-анализом                                │
│  • Экспорт: Excel, PDF, GAEB XML, формат Гранд-Сметы              │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ КП подписали → отправить в ERP
                                 │ (через n8n workflow)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  EXECUTION LAYER (ERPNext)                                        │
│                                                                   │
│  • Проект с задачами и бюджетом (создаётся из BOQ)                │
│  • Закупки (Material Request → RFQ → PO) по позициям BOQ          │
│  • Склад с привязкой к объектам                                   │
│  • HR + табели + зарплата (по факту работ)                        │
│  • Кастомные DocType: КС-2, КС-3, журналы работ                   │
│  • ОТ/ТБ с 16 типами допусков + Telegram-уведомления              │
│  • Бухгалтерия (двойная запись, баланс, ОПУ)                      │
│  • Управленческий учёт (P&L по проектам, cashflow)                │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ факт расходов (КС-2, акты, ЗП)
                                 │ возвращается обратно в OCE для EVM
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  ANALYTICS LAYER (OCE EVM module)                                 │
│                                                                   │
│  • SPI / CPI / EAC                                                │
│  • S-curve план vs факт                                           │
│  • Прогноз окончания                                              │
│  • Алерт превышения бюджета → Telegram директору                  │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Контейнерная схема

```
docker-compose.yml          (основной — твой существующий)
│
├── erpnext-backend         ERPNext v15
├── erpnext-frontend
├── mariadb                 БД ERPNext
├── redis-cache             кэш ERPNext
├── redis-queue             очереди ERPNext
├── twenty-server           CRM
├── twenty-front
├── twenty-postgres         БД Twenty
├── n8n                     шина интеграций
├── n8n-postgres
├── minio                   файловое хранилище
├── gotenberg               PDF-генерация
└── caddy                   reverse proxy (порт 443 → erpnext)

docker-compose.olimp.yml    (надстройка — новая)
│
├── oce-backend             FastAPI (AGPL изолирован)
├── oce-frontend            React/Vite
├── oce-postgres            БД OCE (отдельная)
└── oce-caddy               TLS на 8443 → estimate.olimp-ural.ru

Общая сеть: olimp_network (external)
Общие сервисы: n8n, minio, telegram (используются обоими compose)
```

## 3. Поток данных: тендер → исполнение → анализ

### Шаг 1. Создание BOQ в OCE
```
Сметчик: загружает ТЗ от заказчика (НТМК) → PDF/DWG
OCE: AI Cost Advisor генерирует драфт BOQ
Сметчик: правит, добавляет, матчит на свою базу
Результат: BOQ "Фундамент 7×7 НТМК" v1.0, цена 28 млн ₽
```

### Шаг 2. Отправка заказчику
```
OCE: экспорт BOQ → PDF (КП) + Excel (расшифровка)
Сметчик отправляет в Twenty CRM как activity
```

### Шаг 3. Выиграли тендер
```
В Twenty: Deal "НТМК фундамент" → Won
Trigger: n8n workflow "won-deal-to-project"
n8n: дёргает OCE API → достаёт BOQ "v1.0" → POST в ERPNext
ERPNext: создаётся Project "НТМК-2026-Фундамент" с:
  - Бюджетом 28 млн ₽
  - Tasks из секций BOQ
  - Material Requests из позиций BOQ
  - План закупок по графику
```

### Шаг 4. Исполнение в ERPNext
```
Прораб: закрывает Tasks, выписывает Material Issue
Бухгалтер: проводит акты КС-2 от субподрядчиков
HR: табели → зарплата
ERPNext: автоматически считает фактическую себестоимость по объекту
```

### Шаг 5. Возврат факта в OCE для EVM
```
Каждую ночь: n8n workflow "actuals-to-evm"
ERPNext API → факт расходов по проекту
n8n → OCE API POST /api/projects/{id}/actuals
OCE: пересчитывает SPI, CPI, EAC
Если EAC > бюджет на 5% → Telegram в @klochkov_dmitry
```

## 4. Безопасность и изоляция

| Контур | Сеть | Внешний доступ |
|--------|------|----------------|
| ERPNext | olimp_network | https://erp.olimp-ural.ru |
| Twenty CRM | olimp_network | https://crm.olimp-ural.ru |
| OCE | olimp_network | https://estimate.olimp-ural.ru |
| n8n | olimp_network | https://n8n.olimp-ural.ru (Basic Auth) |
| MariaDB | olimp_network | — (только внутри) |
| Postgres (Twenty/OCE/n8n) | olimp_network | — (только внутри) |
| MinIO | olimp_network | https://s3.olimp-ural.ru |

AGPL-3.0 код OCE никогда не вызывает напрямую GPL-3.0 код ERPNext — только через HTTP/REST через n8n. Это юридически чистая изоляция.

## 5. Резервное копирование

- **MariaDB ERPNext**: bench backup, ежедневно, ротация 30 дней → MinIO bucket `erpnext-backups`
- **Postgres OCE**: pg_dump, ежедневно, ротация 30 дней → MinIO bucket `oce-backups`
- **MinIO**: rclone sync ночью → Backblaze B2 (внешний)
- **n8n workflows**: git-репозиторий, push при каждом изменении (через n8n API)

## 6. Что НЕ берём из OpenConstructionERP

| Фича | Причина |
|------|---------|
| CWICR база 55K позиций | Заточена под западные регионы. У тебя есть ГЭСН/ФЕР через Гранд-Смету. |
| 21 язык | Работа в УрФО, нужен только русский. |
| 20 региональных стандартов | Только ГЭСН/ФЕР + рыночные расценки УрФО. |
| Полный CAD/BIM такеофф (RVT) | Объёмы Олимпа не требуют BIM — заказчики дают спецификации. PDF-такеофф оставляем. |
| DDC Converters (платные) | Не лицензируем, оставляем только PDF-такеофф. |
| GAEB XML экспорт | Не нужен в России. |

## 7. Куда смотреть дальше

1. `docs/02-model-mapping.md` — как сущности OCE мапятся на ERPNext DocType
2. `docs/03-agpl-risks.md` — юридическая чистота для твоей модели бизнеса
3. `docs/04-boq-example-ntmk.md` — пример BOQ на реальной смете
4. `docs/05-implementation-roadmap.md` — план внедрения по неделям
5. `docker-compose.olimp.yml` — рабочий compose-файл (положить рядом с основным)
