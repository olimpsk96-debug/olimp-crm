# n8n Workflows

Папка содержит готовые n8n-воркфлоу для интеграций ERP с внешним миром.
Импортируются в n8n через UI: `http://localhost:5678` → меню (•••) → Import from File.

## Список

| Файл | Назначение | Триггер | Статус |
|------|------------|---------|--------|
| `tenderguru-sync.json` | Sync тендеров с TenderGuru | Cron daily 06:00 | inactive (требует TENDERGURU_API_KEY) |
| `telegram-lead-bot.json` | Приём заявок через Telegram-бота | Telegram message | inactive (требует @OlimpZayavka_bot токен) |

## Установка `telegram-lead-bot`

### 1. Создать второго Telegram-бота (для заявок)

⚠️ Это **отдельный бот**, не путать с `@Olimp_erp_bot` (он шлёт алерты директору).

1. Открой Telegram → `@BotFather`
2. `/newbot`
3. Имя: «Олимп — оставить заявку» (любое)
4. Username: `@OlimpZayavka_bot` (или другое доступное)
5. Скопируй полученный **токен** вида `123456789:AAAA...`
6. Опционально: `/setdescription` → описание бота, `/setuserpic` → лого

### 2. Импортировать workflow в n8n

1. Открой http://localhost:5678 → логин из `.env`
2. Меню `(•••)` → **Import from File** → выбери `telegram-lead-bot.json`
3. Workflow откроется в редакторе

### 3. Добавить credentials для нового бота

1. В узле **Telegram Trigger** → нажми «Create new credential»
2. Имя: `Olimp Zayavka Bot`
3. Access Token: вставь токен из BotFather
4. Save
5. Сделай то же для узлов `Ответить «Заявка принята»` и `Попросить телефон`
   (выбери ту же credential «Olimp Zayavka Bot»)

### 4. Активировать workflow

1. Жми переключатель **Active** в правом верхнем углу
2. Workflow начнёт слушать сообщения боту

### 5. Тестировать

Напиши боту в Telegram:
```
Имя: Тест Тестов
Телефон: +79991234567
Тема: Тест AI
Описание: Проверка интеграции
```

В ответ получишь `✓ Заявка принята (DL-2026-XXXXX)`.
В CRM (`/deals` на фронте) появится новый Deal с source=Telegram.

### Что делает workflow

1. **Telegram Trigger** ловит каждое сообщение боту
2. **Извлечь поля** — JS-нода парсит структурированное сообщение
   («Имя: Х», «Телефон: Y»...) или берёт текст как описание + ник из профиля
3. **Есть телефон?** — IF-нода:
   - Если телефон есть → создаём лид
   - Если нет → просим прислать контакт или структуру
4. **Создать лид в ERP** — HTTP POST на `/api/method/...create_lead` нашего бэкенда
5. **Ответить** — отправляем подтверждение пользователю

URL `http://nginx/...` работает только из контейнера n8n (внутри docker-сети
`olimp_net`). Если n8n запущен снаружи Docker — заменить на
`http://erp.olimp-ural.ru/...` или фактический IP.

## Полезные команды

```bash
# Логи бота за сегодня
docker logs olimp_n8n --since 24h | grep -i telegram

# Перезапуск n8n
docker compose restart n8n

# Импорт workflow из CLI (без UI)
docker exec olimp_n8n n8n import:workflow --input=/path/in/container.json
```
