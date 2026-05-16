-- Content Factory — схема PostgreSQL
-- Применяется автоматически при первом старте content-pg контейнера

\c content;

-- ============================================================
-- Очередь идей (idea_queue) — пополняется discovery-агентом
-- ============================================================
CREATE TABLE IF NOT EXISTS idea_queue (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    cluster TEXT,
    target_keywords TEXT[],
    intent TEXT,                              -- commercial / info / b2b / b2g / case
    page_type TEXT,                           -- service / howto / case / norm / comparison
    target_post_id INT,                       -- WP post ID если обновляем существующее
    target_service_id INT,                    -- связь со страницей услуги
    source TEXT NOT NULL,                     -- yandex_wordstat / google_trends / serp_gap / competitor / reddit / tender / ai_visibility / manual
    source_meta JSONB,                        -- {keyword_volume, gap_competitor, tender_id, ...}
    priority_score NUMERIC(4,2),              -- 0.00-1.00 после prioritization
    status TEXT NOT NULL DEFAULT 'new',       -- new / in_progress / done / rejected / failed
    season TEXT,                              -- Q1 / Q2 / Q3 / Q4 / null (всесезонная)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    picked_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idea_queue_status_priority_idx ON idea_queue (status, priority_score DESC);
CREATE INDEX IF NOT EXISTS idea_queue_season_idx ON idea_queue (season);
CREATE INDEX IF NOT EXISTS idea_queue_target_post_idx ON idea_queue (target_post_id);

-- ============================================================
-- Статьи (articles) — сгенерированные writer'ом
-- ============================================================
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    h1 TEXT,
    intro TEXT,                                -- ответ-extract для AI
    body_md TEXT NOT NULL,                     -- основной markdown
    body_html TEXT,                            -- готовый HTML для WP
    meta_description TEXT,
    keywords TEXT[],
    faq_jsonb JSONB,                          -- [{"question": "...", "answer": "..."}, ...]
    schema_jsonb JSONB,                        -- готовый JSON-LD для WP head
    target_word_count INT,
    actual_word_count INT,
    cluster TEXT,
    author_id INT,
    cover_image_url TEXT,
    inline_images JSONB,                       -- [{url, alt, caption}, ...]
    video_url TEXT,                            -- ссылка на MinIO с Reel
    idea_queue_id INT REFERENCES idea_queue(id) ON DELETE SET NULL,
    parent_post_id INT,                        -- WP ID если это refresh существующей
    status TEXT NOT NULL DEFAULT 'draft',      -- draft / approved / published / rejected
    qa_scores JSONB,                          -- {eeat, factcheck, seo, aeo, originality}
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS articles_status_idx ON articles (status);
CREATE INDEX IF NOT EXISTS articles_cluster_idx ON articles (cluster);

-- ============================================================
-- Публикации (publications) — куда раскатили статью
-- ============================================================
CREATE TABLE IF NOT EXISTS publications (
    id SERIAL PRIMARY KEY,
    article_id INT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,                    -- wp / telegram / instagram_post / instagram_reel / tiktok / postiz
    platform_post_id TEXT,                     -- WP post_id, TG message_id, IG media_id, TT video_id
    url TEXT,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',    -- pending / scheduled / published / failed
    error TEXT,
    response_meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS publications_article_idx ON publications (article_id);
CREATE INDEX IF NOT EXISTS publications_platform_status_idx ON publications (platform, status);

-- ============================================================
-- Метрики аналитики (metrics) — daily snapshot
-- ============================================================
CREATE TABLE IF NOT EXISTS metrics_daily (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    article_id INT REFERENCES articles(id) ON DELETE CASCADE,
    publication_id INT REFERENCES publications(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    metric_set JSONB NOT NULL,                 -- {impressions, clicks, ctr, position, dwell_time, conversions, ...}
    UNIQUE(date, publication_id)
);
CREATE INDEX IF NOT EXISTS metrics_daily_date_idx ON metrics_daily (date);
CREATE INDEX IF NOT EXISTS metrics_daily_article_idx ON metrics_daily (article_id);

-- ============================================================
-- AI Visibility — упоминания бренда в ChatGPT/Perplexity/Yandex Neuro
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_visibility (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    engine TEXT NOT NULL,                      -- chatgpt / perplexity / claude / gemini / yandex_neuro
    query TEXT NOT NULL,
    brand_mentioned BOOLEAN NOT NULL,
    article_id INT REFERENCES articles(id) ON DELETE SET NULL,
    citation_position INT,                     -- 1, 2, 3... если упомянули; NULL если нет
    competitor_mentioned TEXT[],
    raw_response TEXT,
    UNIQUE(date, engine, query)
);
CREATE INDEX IF NOT EXISTS ai_visibility_date_engine_idx ON ai_visibility (date, engine);
CREATE INDEX IF NOT EXISTS ai_visibility_brand_idx ON ai_visibility (brand_mentioned);

-- ============================================================
-- Decay / Refresh events — что и когда обновлялось
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_events (
    id SERIAL PRIMARY KEY,
    article_id INT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decay_metric TEXT NOT NULL,                -- position_drop / ctr_drop / ai_citation_lost / serp_gap_new
    decay_value JSONB,                         -- {before: 5, after: 12, delta_pct: -140}
    refresh_status TEXT NOT NULL DEFAULT 'queued',  -- queued / running / done / failed
    new_article_id INT REFERENCES articles(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS refresh_events_status_idx ON refresh_events (refresh_status);

-- ============================================================
-- Источники данных (sources_snapshots) — что собирал discovery
-- ============================================================
CREATE TABLE IF NOT EXISTS discovery_snapshots (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL,
    payload JSONB NOT NULL,
    ideas_extracted INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS discovery_snapshots_run_idx ON discovery_snapshots (run_id);
CREATE INDEX IF NOT EXISTS discovery_snapshots_source_idx ON discovery_snapshots (source, run_at);
