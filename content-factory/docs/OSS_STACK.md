# OSS Stack — реестр зависимостей контент-завода (2026-05-17)

Все компоненты выбраны после параллельного ресерча по 4 направлениям. Только активные проекты с разрешительной лицензией (MIT/Apache/BSD). AGPL допустим только для self-hosted сервисов (Postiz).

---

## 1. AI-агенты и оркестрация

| Проект | URL | Звёзды | Lang | Лицензия | Где используем |
|---|---|---|---|---|---|
| **CrewAI** | https://github.com/crewAIInc/crewAI | 51.5k | Python | MIT | MVP: команда researcher→outliner→writer→fact_checker→seo_aeo→editor |
| **LangGraph** | https://github.com/langchain-ai/langgraph | 32.2k | Python | MIT | Production loop: stateful refresh-агент с GSC-аналитикой |
| **Agno** | https://github.com/agno-agi/agno | 40.2k | Python | Apache-2.0 | На вырост — production deploy агентов |
| ⚠️ AutoGen | https://github.com/microsoft/autogen | 58.1k | Python | MIT | НЕ используем — maintenance mode с сент 2025 |

## 2. Research

| Проект | URL | Звёзды | Lang | Лицензия | Где используем |
|---|---|---|---|---|---|
| **GPT Researcher** | https://github.com/assafelovic/gpt-researcher | 27.1k | Python | Apache-2.0 | Deep research для writer-агента (планер+экзекьютор) |
| **Crawl4AI** | https://github.com/unclecode/crawl4ai | 58k+ | Python | Apache-2.0 | LLM-friendly scraping конкурентов + SERP top-10 |
| **STORM** | https://github.com/stanford-oval/storm | 28.2k | Python | MIT | Опционально для очень длинных pillar-статей |
| ⚠️ Firecrawl | https://github.com/firecrawl/firecrawl | 40k+ | TS | AGPL-3.0/MIT | AGPL — заменили на Crawl4AI |

## 3. RAG

| Проект | URL | Звёзды | Lang | Лицензия | Где используем |
|---|---|---|---|---|---|
| **Qdrant** | https://github.com/qdrant/qdrant | — | Rust | Apache-2.0 | Уже работает в olimp-erp. Коллекции: own_content, norms_sp, norms_gost, cases, competitors |
| **BAAI/bge-m3** | https://huggingface.co/BAAI/bge-m3 | — | — | MIT | Multilingual embeddings, лучший для RU 2026, 8k context |

## 4. Trend Discovery

| Проект | URL | Звёзды | Lang | Лицензия | Где используем |
|---|---|---|---|---|---|
| **OpenSEO** | https://github.com/every-app/open-seo | ~2k | TS | MIT | DataForSEO-based SEO toolkit (keyword volume, SERP, rank tracking) |
| **YARS** | https://github.com/datavorous/yars | — | Python | MIT | Reddit без API-ключей — поиск болей строителей |
| ⚠️ PyTrends | https://github.com/GeneralMills/pytrends | — | Python | Apache-2.0 | НЕ используем — архивирован с апреля 2025 |

## 5. WordPress

| Компонент | URL | Лицензия | Где используем |
|---|---|---|---|
| **WP REST API** | core WP | GPL | Прямые запросы через requests/httpx + Application Passwords |
| **Automattic wordpress-mcp** | https://github.com/Automattic/wordpress-mcp | GPL-2.0 | MCP-сервер если переходим на agentic-стиль |
| **Yoast SEO** | wordpress.org | GPL | Уже стоит на promalp-ural.ru — пишем meta через REST + postmeta |
| **ACF Pro** | advancedcustomfields.com | GPL | Уже стоит — туда ходим за schema_jsonld_extra и landing fields |
| Schemify | https://github.com/stevegrunwell/schemify | PHP/MIT | Опционально для дополнительных Schema-типов |

## 6. SMM-публикация

| Платформа | Проект | URL | Лицензия | Где используем |
|---|---|---|---|---|
| **Hub** | Postiz | https://github.com/gitroomhq/postiz-app | AGPL-3.0 | Self-host single-source для мульти-публикации, 18+ платформ |
| Telegram | aiogram | https://github.com/aiogram/aiogram | MIT | Канал @promalp_ural, MarkdownV2, media groups |
| Instagram | instagrapi | https://github.com/subzeroid/instagrapi | MIT | Posts, Reels, Stories — fallback на Meta Graph API |
| TikTok | wkaisertexas/tiktok-uploader | https://github.com/wkaisertexas/tiktok-uploader | MIT | Playwright-based, cover image, schedule |
| TikTok (official) | TikTok Content Posting API | — | Proprietary | Если получим developer approval |

## 7. Генерация изображений

| Проект | URL | Лицензия | Где используем |
|---|---|---|---|
| **ComfyUI** | https://github.com/comfyanonymous/ComfyUI | GPL-3.0 | Self-hosted (не дистрибутим — GPL ОК) |
| **FLUX.1 [schnell]** | https://huggingface.co/black-forest-labs/FLUX.1-schnell | Apache-2.0 | Cover-изображения статей |
| **FLUX.1 [dev]** | https://huggingface.co/black-forest-labs/FLUX.1-dev | non-commercial | НЕ используем — лицензия не подходит |
| **SD3.5 Large** | https://huggingface.co/stabilityai/stable-diffusion-3.5-large | Community License | Для инфографики с текстом |
| **OpenAI gpt-image-1** | API | Proprietary | Fallback если ComfyUI/GPU недоступен |

## 8. Видео и TTS

| Проект | URL | Лицензия | Где используем |
|---|---|---|---|
| **reelsmaker** | https://github.com/steinathan/reelsmaker | MIT | Faceless-video pipeline 9:16 |
| **Viral-Faceless-Shorts** | https://github.com/Dark2C/Viral-Faceless-Shorts-Generator | MIT | Альтернативный pipeline (контейнеризован) |
| **LTX-Video 13B** | https://github.com/Lightricks/LTX-Video | OpenRail-M | Быстрая генерация бэкграундов |
| **Open-Sora 2.0** | https://github.com/hpcaitech/Open-Sora | Apache-2.0 | Опционально для длинных видео |
| **Silero TTS** | https://github.com/snakers4/silero-models | GPL-3.0* | Лучшее RU-озвучивание (CPU-friendly) |
| **CosyVoice 2.0** | https://github.com/FunAudioLLM/CosyVoice | Apache-2.0 | Multilingual TTS, voice cloning |
| **F5-TTS** | https://github.com/SWivid/F5-TTS | MIT | Альтернатива (RU только через community fine-tunes) |
| **Yandex SpeechKit** | https://cloud.yandex.ru/services/speechkit | Proprietary | Fallback — лучший RU в production |

\* Silero для образования бесплатен; коммерческое использование — отдельная лицензия. Если для production — берём CosyVoice.

## 9. SEO/AEO/GEO

| Проект | URL | Лицензия | Где используем |
|---|---|---|---|
| **AutoGEO** | https://github.com/cxcscmu/AutoGEO | Apache-2.0 | GEO-rewrite паттерны для seo_aeo агента |
| **GetCito** | https://github.com/ai-search-guru/getcito-... | MIT | OSS-аудит AIO/AEO/GEO |
| **GEO Optimizer Skill** | https://github.com/Auriti-Labs/geo-optimizer-skill | MIT | CLI-аудит как Claude-skill |
| **Gego** | https://github.com/AI2HU/gego | MIT | Трекер промптов по LLM + извлечение ключей |
| **awesome-GEO** | https://github.com/amplifying-ai/awesome-generative-engine-optimization | — | Курируемый список 2026 |

## 10. Аналитика

| Цель | Проект | URL | Лицензия |
|---|---|---|---|
| GSC | joshcarty/google-searchconsole | https://github.com/joshcarty/google-searchconsole | MIT |
| GA4 (official) | google-analytics-data | https://github.com/googleapis/python-analytics-data | Apache-2.0 |
| GA4 (pandas) | gapandas4 | https://github.com/practical-data-science/gapandas4 | MIT |
| Yandex.Метрика | tapi-yandex-metrika | https://github.com/pavelmaksimov/tapi-yandex-metrika | MIT |
| Yandex.Webmaster | self-built на requests | — | — |
| SERP scrape | SearXNG self-host | https://github.com/searxng/searxng | AGPL-3.0 |
| **AI Visibility** | sharozdawa/ai-visibility | https://github.com/sharozdawa/ai-visibility | MIT |

## 11. SEO crawl (внутренний аудит)

| Проект | URL | Лицензия |
|---|---|---|
| **LibreCrawl** | https://github.com/PhialsBasement/LibreCrawl | MIT — лучший Screaming Frog OSS-клон 2026 |
| **Open SEO Crawler** | https://github.com/puneetindersingh/open-seo-crawler | MIT |

## 12. Internal Linking

| Проект | URL | Лицензия | Где используем |
|---|---|---|---|
| **LinkBoss** (WP plugin) | https://wordpress.org/plugins/semantic-linkboss/ | GPL | Семантическое связывание на WP-стороне |
| **pymorphy3** | https://github.com/no-plagiarism/pymorphy3 | MIT | RU морфология для собственного internal-linker |

---

## Принципы выбора (2026)

1. **Лицензия** — MIT/Apache по умолчанию. GPL только для self-host (ComfyUI). AGPL только для standalone-сервисов (Postiz, SearXNG).
2. **Активность** — последний коммит ≤ 6 месяцев.
3. **Звёзды** — не главный критерий, но < 500 редко берём (за исключением узкоспециализированных tools).
4. **Документация** — обязательна для production-зависимостей.
5. **RU-поддержка** — для TTS, embeddings, морфологии.

## Что НЕ берём (анти-список)

- **AutoGen** (Microsoft) — maintenance mode с сент 2025, мигрируется на Agent Framework
- **PyTrends** — архивирован с апреля 2025, Google заблокировал
- **AI Scribe** (WP plugin) — устарел + GPL-3 заразный
- **Firecrawl** — AGPL даже для cloud-варианта неудобен; заменили Crawl4AI
- **FLUX.1 [dev]** — non-commercial лицензия не подходит коммерции
- **Coqui XTTS-v2** — Coqui Public License (non-commercial по дефолту)
