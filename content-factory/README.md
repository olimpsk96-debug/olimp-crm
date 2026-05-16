# Content Factory — Контент-завод ОЛИМП

Автоматическая система генерации, публикации и оптимизации SEO-контента для компании ОЛИМП (промышленный альпинизм + промстроительство, 74 услуги). Сайт: **promalp-ural.ru**.

Полная документация: [CONTENT_FACTORY.md](./CONTENT_FACTORY.md)

## Стек 2026

- **Оркестрация:** CrewAI (MVP) + LangGraph (production-loop)
- **Research:** GPT Researcher + Crawl4AI + Qdrant RAG (СП/ГОСТ)
- **LLM:** Claude Opus 4.7 (1M context) — основной writer
- **Images:** ComfyUI + FLUX.1 [schnell]
- **Video:** reelsmaker + LTX-Video + Silero TTS (RU)
- **SMM:** Postiz + aiogram + instagrapi + tiktok-uploader
- **WP:** REST API + Automattic wordpress-mcp
- **SEO/AEO:** Rank Math + AutoGEO + Schemify (JSON-LD)
- **Analytics:** GSC + GA4 + Яндекс.Метрика + AI-Visibility

## Структура

```
content-factory/
├── config/             # источники трендов, ключи, темы, tone of voice
├── pipeline/
│   ├── discovery/      # поиск трендов (Wordstat, SERP, Reddit, конкуренты)
│   ├── research/       # GPT Researcher + RAG нормативки
│   ├── writer/         # CrewAI команда писателей
│   ├── visual/         # генерация изображений и видео
│   ├── publisher/      # WP, Telegram, Instagram, TikTok
│   ├── analytics/      # GSC, GA4, Метрика, AI-visibility
│   └── refresh/        # LangGraph loop авто-обновления
├── orchestrator/       # cron-точки входа (daily/weekly)
├── storage/            # схемы PostgreSQL, Qdrant collections
├── prompts/            # промпты CrewAI агентов
├── templates/          # Jinja2 шаблоны статей и JSON-LD
└── scripts/            # bootstrap, seed нормативки, тесты
```

## Быстрый старт (после полной реализации)

```bash
cp .env.content.example .env.content
# заполнить ключи (Anthropic, GSC, GA4, WP, Telegram, IG, TikTok)
docker compose -f docker-compose.content.yml --env-file .env.content up -d
python -m orchestrator.generate_article --topic "Герметизация межпанельных швов"
```

## Roadmap (фазы)

| Фаза | Статус | Содержимое |
|---|---|---|
| F1 Каркас | 🟡 в работе | структура, конфиги, документация |
| F2 MVP писатель | ⚪ план | CrewAI команда → markdown + JSON-LD |
| F3 WP + Telegram | ⚪ план | автопубликация на сайт + канал |
| F4 Видео + IG/TikTok | ⚪ план | faceless-video + публикация |
| F5 Analytics-loop | ⚪ план | автообновление по GSC + AI-visibility |
