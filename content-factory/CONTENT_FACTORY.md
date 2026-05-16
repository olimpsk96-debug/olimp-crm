# Content Factory — полная архитектура

Дата: 2026-05-17. Версия документа: 1.1 (после привязки к реальному сайту promalp-ural.ru).

## 1. Цели системы

1. **Автоматически генерировать SEO-статьи** для **promalp-ural.ru** на 74+ услуги ОЛИМП. Главная специализация:
   - Промышленный альпинизм (высотные работы)
   - Промышленное строительство
   - Услуги для УК, ТСЖ, промпредприятий (фасады, кровля, герметизация, АКЗ, реклама, такелаж)
2. **Публиковать одновременно** на WordPress + Telegram + Instagram + TikTok с адаптацией контента под каждую платформу.
3. **Отслеживать показатели** (позиции в Яндекс/Google, видимость в ChatGPT/Perplexity/Яндекс.Нейро, поведенческие).
4. **Автоматически дорабатывать статьи** при просадке (Content Decay loop, 13-недельный цикл).
5. **Ранжироваться в топ** Яндекс (76% рынка РФ) + Google AIO + AI-ответчиках.

## 2. Стратегические принципы (2026)

### 2.1. Главный поисковик — Яндекс, не Google
- Доля Яндекса в РФ: **76.3%**
- Yandex Neuro (нейроответы) — главный приоритет, не Google AIO
- YATI-трансформер ценит живой русский язык и морфологическое богатство выше плотности ключевиков
- Поведенческие факторы (dwell time, return-to-SERP) у Яндекса жёстче чем у Google
- Геосигналы (Яндекс.Бизнес + 2ГИС + Яндекс.Карты) важнее ссылок

### 2.2. AEO/GEO обязательны
- Schema.org JSON-LD (Article + FAQPage + HowTo + LocalBusiness + Service) — главный канал в AI-ответчики
- **llms.txt** — внедряем (10 минут), но трафика не ждём; Google официально не поддерживает (Illyes, 2025)
- Структура «краткий ответ в первом абзаце» → AI-движки берут его как extract
- AI Citation Decay: цитаты гаснут за ~13 недель — обновлять поквартально

### 2.3. E-E-A-T для стройки
- Автор-эксперт (фото прораба, должность, опыт) — алгоритмы 2026 ранжируют выше
- Кейсы с цифрами, адресами, ценами, фото до/после
- Видео процесса с объектов (отдельный сильный сигнал)
- Локальный фокус (Свердловская область, Урал)

### 2.4. Чего НЕ делать
- Не публиковать чистый AI-spam (Google March 2025 Core Update + SpamBrain штрафуют жёстко)
- Не использовать GPL-3 OSS в закрытом стеке (AI Scribe) — для коммерческого продукта берём только MIT/Apache
- Не использовать `pytrends` (Google Trends, заархивирован с апреля 2025)

## 3. Контент-стратегия

### 3.1. Топ-50 ключевых запросов
Хранятся в [config/keywords.yml](./config/keywords.yml).

Категории:
- Коммерческие ВЧ (промышленный альпинизм екатеринбург ~3-5k/мес и т.д.)
- Информационные (как усилить балку углеволокном)
- Long-tail (усиление балки углеволокном пример расчёта)
- Тендерные / B2B (подрядчик АКЗ свердловская область)

### 3.2. Топ-30 контент-идей (приоритизированы)
Хранятся в [config/topics.yml](./config/topics.yml).

Кластеры:
- HowTo / гайды (P1, SEO-магниты)
- Кейсы с цифрами (P1, конверсия + E-E-A-T)
- Сравнения материалов / методов (P2, для проектировщиков)
- Чек-листы / калькуляторы (P1, лидмагниты)
- Разбор нормативки (P2, для ГИПов)
- Тренды / аналитика (P3, для соцсетей)

### 3.3. GAP-анализ конкурентов (Екатеринбург)

| Конкурент | Лет | Услуг | Слабые места |
|---|---|---|---|
| Алп-Ур (alp-ur.ru) | 25+ | 12 | Узкий охват услуг, нет видео-кейсов |
| На Высоте (na-vysote.pro) | — | 100+ | Нет глубоких pillar-статей |
| Зенит (promalp-z.ru) | 10 | 18 | Узкий охват |
| Урал Мен (uralmen.ru) | — | 24 | Блог почти пустой |
| Промальп 66 | 8+ | 6 | Очень узкий, нет блога |
| **ОЛИМП (наш)** | **17+** | **74** | **Самый широкий охват — главное преимущество** |

**Свободная ниша:** глубокий локальный блог с кейсами реальных клиентов (ЕВРАЗ, РУСАЛ, БЦ Президент, Ледовая арена Сириус), видео, калькуляторами и **региональные посадочные** (никто не закрыл Нижний Тагил, Первоуральск, Серов).

### 3.4. Tone of Voice
Хранится в [config/brand_voice.yml](./config/brand_voice.yml).

- Экспертно-технический B2B
- Цифры, ГОСТы, СП, фото с объектов
- Без воды, без маркетинговых клише
- Подпись инженера-эксперта
- Длина: 2500-4000 слов на pillar, 1200-1800 на кейсе

### 3.5. Сезонность
- **Q1** (янв-март): зимний промальп, подготовка к тендерному сезону
- **Q2** (апр-июнь): пик трафика «промальп», «фасад», герметизация швов
- **Q3** (июль-сент): АКЗ резервуаров, усиление CFRP (сухая погода)
- **Q4** (окт-дек): консервация, ретроспектива кейсов, тендерное планирование

## 4. Архитектура системы

### 4.1. Поток данных

```
DISCOVERY (daily 06:00 МСК)
    │
    ├── Wordstat (через Direct API forecast)
    ├── Google Trends (через DataForSEO в OpenSEO)
    ├── SERP top-10 конкурентов (Crawl4AI)
    ├── Reddit / Pikabu / VC (YARS)
    ├── Тендерные площадки (tenderok API)
    └── AI-Visibility (трекинг бренда в ChatGPT/Perplexity)
        │
        ▼
    postgres.idea_queue (priority, cluster, keywords, source_meta)
        │
        ▼
RESEARCH + WRITER (CrewAI multi-agent, on demand)
    │
    ├── 1. Researcher Agent (GPT Researcher + Crawl4AI)
    │       → собирает фактуру с топ-10 SERP + RAG нормативки в Qdrant
    │
    ├── 2. Outliner Agent
    │       → структура H1/H2/H3 + FAQ-блок + Schema-разметка
    │
    ├── 3. Writer Agent (Claude Opus 4.7)
    │       → 2500-4000 слов RU, B2B-тон, цифры, кейсы
    │
    ├── 4. Fact-Checker Agent
    │       → проверка цифр и формулировок против Qdrant RAG (СП 164, ГОСТ 9.402)
    │
    ├── 5. SEO/AEO Optimizer Agent (AutoGEO patterns)
    │       → структура «answer first», LSI-ключи, FAQ, schema hints
    │
    └── 6. E-E-A-T Polisher Agent
            → подпись автора, цены, локальные сигналы (Екатеринбург)
        │
        ▼
    storage/articles/{slug}/
        ├── article.md
        ├── meta.json (title, h1, description, keywords, faq, schema)
        ├── images_prompts.json
        └── video_script.md
        │
        ▼
VISUAL (parallel)
    │
    ├── Image generator: ComfyUI workflow + FLUX.1 [schnell]
    │       → cover.webp + 3-5 inline-инфографик
    │
    └── Video generator: reelsmaker
            ├── TTS Silero (RU) на основе video_script.md
            ├── LTX-Video для бэкграундов
            └── FFmpeg монтаж 9:16 (Reels/TikTok)
        │
        ▼
    MinIO bucket: articles/{slug}/
        │
        ▼
PUBLISHER (n8n orchestrates + Postiz + custom adapters)
    │
    ├── WordPress (REST API + JWT)
    │       ├── Article → /wp-json/wp/v2/posts
    │       ├── Featured image → /wp-json/wp/v2/media
    │       ├── JSON-LD Article + FAQPage + LocalBusiness
    │       └── Internal linking (LinkBoss-style)
    │
    ├── Telegram (aiogram 3.x)
    │       ├── Lead-абзац + ключевые пункты + CTA + ссылка
    │       └── Media group: cover + 2-3 инфографики
    │
    ├── Instagram (instagrapi + Meta Graph API)
    │       ├── Post (carousel из cover + инфографик)
    │       └── Reel (faceless-video из reelsmaker)
    │
    └── TikTok (wkaisertexas/tiktok-uploader)
            └── Reel + cover + caption + hashtags
        │
        ▼
    postgres.publications
    (url, platform_id, slug, platform, published_at, scheduled_at)
        │
        ▼
ANALYTICS LOOP (weekly Sunday 22:00 МСК)
    │
    ├── GSC API → joshcarty/google-searchconsole
    │       → позиции, CTR, impressions по статьям
    │
    ├── GA4 API → gapandas4
    │       → сессии, dwell time, конверсии в заявку
    │
    ├── Yandex.Metrika API → tapi-yandex-metrika
    │       → поведенческие, цели, источники
    │
    ├── Yandex.Webmaster API
    │       → ИКС, индексация, переобход
    │
    └── AI-Visibility → sharozdawa/ai-visibility
            → упоминания в ChatGPT/Perplexity/Claude/Gemini/Яндекс.Нейро
        │
        ▼
    postgres.metrics (daily snapshot per article per platform)
        │
        ▼
DECAY DETECTOR (LangGraph stateful agent)
    │
    ├── Detect decay 20%+ over 4 weeks
    ├── Detect AI-citation drop
    ├── Compare to top-10 SERP (Crawl4AI re-scrape)
    └── Generate refresh-task → put back in idea_queue (priority=urgent)
        │
        ▼
RE-RUN WRITER (с pre-loaded существующей статьёй)
```

### 4.2. Сервисы (новые контейнеры в docker-compose.content.yml)

| Сервис | Порт | Назначение |
|---|---|---|
| `content-pipeline` | 8100 | FastAPI основной воркер (CrewAI пайплайн) |
| `content-discovery` | 8101 | Crawler + Wordstat + Reddit (планировщик трендов) |
| `content-comfyui` | 8188 | ComfyUI с FLUX-моделями (GPU optional) |
| `content-reelsmaker` | 8102 | Faceless-video pipeline |
| `content-postiz` | 5000 | Postiz UI + API (мульти-публикация) |
| `content-analytics` | 8103 | GSC/GA4/Метрика воркер |
| `content-pg` | 5433 | PostgreSQL для контент-завода (отдельно от ERPNext) |

Все шарят с olimp-erp:
- `qdrant` (RAG нормативки)
- `minio` (медиа)
- `redis` (очереди Celery)
- `n8n` (визуальная оркестрация)
- nginx с проксированием на `content-pipeline`

### 4.3. Безопасность и лицензии
- Только MIT/Apache/BSD в `requirements.txt`
- AGPL (Postiz) — допустимо т.к. self-host, не дистрибутим
- GPL-3 (AI Scribe) — избегаем
- API ключи в `.env.content` (gitignore)
- Vault для production (на вырост)

## 5. RAG база знаний (Qdrant)

Коллекции:
- **`own_content`** — 74 услуги + 31 статья + 7 портфолио с promalp-ural.ru (СВОЁ — критично для consistency и анти-каннибализации)
- `norms_sp` — СП по высотным работам, фасадам, кровле, АКЗ (СП 28, СП 70, СП 13, СП 164 и др.)
- `norms_gost` — ГОСТ 9.402 АКЗ, ГОСТ Р 56329 промальп и др.
- `norms_rd` — Приказ 782н (правила охраны труда на высоте), РД АКЗ Транснефти
- `cases` — собственные кейсы ОЛИМП с цифрами (ЕВРАЗ, РУСАЛ, БЦ Президент)
- `competitors` — снэпшоты экспертных статей топ-конкурентов (для gap-анализа)
- `qa_pairs` — частые вопросы заказчиков и ответы

Embeddings: `BAAI/bge-m3` (multilingual, 8k context, лучший для RU в 2026).

**Критично:** `own_content` — это база для writer-агента, чтобы избегать каннибализации (две статьи на одну тему) и держать единство стиля и фактов.

## 6. Конфигурация (что заполнить в `.env.content`)

```
# LLM
ANTHROPIC_API_KEY=
OPENAI_API_KEY=                 # для FLUX через gpt-image fallback и Whisper

# Trend discovery
SERPAPI_KEY=                    # либо DATAFORSEO_LOGIN/PASSWORD
YANDEX_DIRECT_TOKEN=            # Wordstat forecast
TENDEROK_API_KEY=

# WordPress (promalp-ural.ru)
WP_URL=https://promalp-ural.ru
WP_URL_LOCAL=http://promalp.test
WP_USER=                        # WP admin/editor login
WP_APP_PASSWORD=                # Application Password из админки WP (НЕ пароль аккаунта)

# Telegram (канал ОЛИМП)
TG_BOT_TOKEN=
TG_CHANNEL_ID=                  # @promalp_ural или -1001234...
TG_CHAT_FOR_REVIEW=             # личный чат для preview перед публикацией

# Instagram (Meta Graph API)
IG_BUSINESS_ACCOUNT_ID=
IG_ACCESS_TOKEN=
# fallback (instagrapi private API)
IG_USERNAME=
IG_PASSWORD=
IG_SESSION_PATH=/data/ig_session.json

# TikTok
TIKTOK_USERNAME=
TIKTOK_COOKIES_PATH=/data/tiktok_cookies.txt

# Analytics
GSC_SERVICE_ACCOUNT_JSON=/data/gsc-sa.json
GA4_PROPERTY_ID=
GA4_SERVICE_ACCOUNT_JSON=/data/ga4-sa.json
YANDEX_METRIKA_TOKEN=
YANDEX_METRIKA_COUNTER_ID=
YANDEX_WEBMASTER_TOKEN=
YANDEX_WEBMASTER_HOST_ID=

# Postiz
POSTIZ_API_URL=http://postiz:5000
POSTIZ_API_KEY=

# AI Visibility
AI_VIS_BRANDS=ОЛИМП,olimp,remstroy66,промышленный альпинизм Екатеринбург
```

## 7. Точки входа (entry points)

| Скрипт | Запуск | Что делает |
|---|---|---|
| `orchestrator/daily_discovery.py` | cron 06:00 МСК | Обновляет idea_queue по всем источникам |
| `orchestrator/generate_article.py` | по запросу/cron | Запускает CrewAI на конкретной теме из очереди |
| `orchestrator/publish.py` | после генерации | Раскатывает статью на все платформы |
| `orchestrator/weekly_analytics.py` | cron вс 22:00 МСК | Тянет GSC + GA4 + Метрика + AI-visibility |
| `orchestrator/refresh_loop.py` | cron еж. 03:00 МСК | LangGraph loop: detect decay → re-write |
| `scripts/seed_qdrant_norms.py` | один раз | Загружает нормативку (PDF СП/ГОСТ) в Qdrant |

## 8. Текущий статус и следующий шаг

**Фаза 1 (Каркас) — в работе:**
- ✅ Структура каталогов
- ✅ Документация архитектуры
- ✅ Конфиги (sources, keywords, topics, brand_voice)
- ⚪ docker-compose.content.yml
- ⚪ requirements.txt
- ⚪ Промпты CrewAI
- ⚪ schemas.sql

**Следующий шаг:** Фаза 2 — реализация CrewAI команды и first runnable `generate_article.py`.

## 9. Ссылки на используемые OSS (с лицензиями)

См. [docs/OSS_STACK.md](./docs/OSS_STACK.md) — полный реестр зависимостей с git-ссылками и звёздами на момент 2026-05-17.
