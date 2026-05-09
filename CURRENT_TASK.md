# CURRENT_TASK.md

**Обновляется в начале и в конце каждой сессии разработки.**
**Claude Code читает этот файл первым делом — здесь актуальная задача.**

---

## 📍 Текущая фаза

**Фаза 0 — Инфраструктура** (1 неделя, ~36 часов)

Цель: рабочая среда разработки + production-ready инфраструктура на Selectel.

---

## 🎯 Активная задача

**0.1 — Локальная инфраструктура (Docker Compose)**

### Что нужно сделать
- [x] Распаковать архив проекта в `~/Projects/olimp-erp`
- [x] Установить инструменты (Docker, Node, Python, Claude Code)
- [x] Открыть в VSCode/Cursor
- [x] Создать `.env` с паролями
- [x] Создать `docker-compose.dev.yml` для локальной разработки
- [x] Создать директории проекта
- [x] Создать скелет frontend (Next.js) и backend (Frappe app)
- [ ] Запустить dev-стек: `docker compose -f docker-compose.dev.yml up -d`
- [ ] Проверить ERPNext UI: http://localhost:8080
- [ ] Проверить n8n: http://localhost:5678
- [ ] Проверить Qdrant: http://localhost:6333/dashboard
- [ ] Установить зависимости frontend: `cd frontend && npm install`
- [ ] Запустить Next.js dev: `cd frontend && npm run dev` → http://localhost:3000
- [ ] Сделать первый коммит и пуш в Git

### Команды (cheat sheet)

```bash
# Запустить весь стек
cd ~/Projects/olimp-erp
docker compose -f docker-compose.dev.yml up -d

# Логи ERPNext
docker logs olimp_backend --tail 100 -f

# Статус сервисов
docker compose -f docker-compose.dev.yml ps

# Внутри backend-контейнера
docker exec -it olimp_backend bash

# Next.js (в отдельном терминале)
cd frontend && npm install && npm run dev

# Остановка
docker compose -f docker-compose.dev.yml down
```

### Блокеры
- [ ] Нет — всё локально, не нужны внешние сервисы

---

## 📋 Следующие задачи (Фаза 0)

**0.2 — Production VPS на Selectel** (4-6 часов)
- [ ] Заказать VPS 4 vCPU / 16GB / 100GB NVMe (~5K ₽/мес)
- [ ] SSH доступ + защита (отключить root, настроить firewall)
- [ ] Установить Docker + Docker Compose
- [ ] Настроить домен `erp.olimp-ural.ru` → IP сервера
- [ ] SSL через Let's Encrypt (certbot)
- [ ] Развернуть тот же docker-compose.yml на проде
- [ ] Настроить ежедневные бэкапы в Yandex Object Storage

**0.3 — Регистрация внешних сервисов** (2-3 часа)
- [ ] Anthropic API ключ (console.anthropic.com)
- [ ] OpenAI API ключ (platform.openai.com)
- [ ] TenderOK подписка (~3K ₽/мес)
- [ ] Yandex Object Storage bucket для бэкапов
- [ ] Telegram Bot (через @BotFather)
- [ ] Все ключи — в `.env` на проде, никогда в Git

**0.4 — CI/CD** (4-6 часов)
- [ ] GitHub Actions для запуска тестов на push
- [ ] Скрипт деплоя `scripts/deploy.sh`
- [ ] Pre-commit хуки (ruff, eslint)
- [ ] Автоматический бэкап БД cron'ом

---

## 🛑 Чего НЕ делать в Фазе 0

- Не создавать DocType (это Фаза 1)
- Не писать бизнес-логику
- Не деплоить на прод без бэкапов
- Не оставлять дефолтные пароли в `.env`

---

## 📝 Заметки сессии

### Сессия 1 — DD.MM.YYYY

**Что сделано:**
-

**Проблемы:**
-

**Что дальше:**
-

---

## 🔗 Ссылки на документацию

- [CLAUDE.md](./CLAUDE.md) — главные правила
- [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектура
- [MVP_ROADMAP_v3.md](./MVP_ROADMAP_v3.md) — план работ
- [SCHEMA_v5.md](./SCHEMA_v5.md) — схема данных
- [AI_ASSISTANT.md](./AI_ASSISTANT.md) — AI-модуль
- [EQUIPMENT.md](./EQUIPMENT.md) — модуль техники
- [prototypes/](./prototypes/) — HTML-референсы

External:
- Frappe docs: https://docs.frappe.io/framework
- ERPNext docs: https://docs.erpnext.com/v15
- Next.js: https://nextjs.org/docs
- Claude API: https://docs.anthropic.com
