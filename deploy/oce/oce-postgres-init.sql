-- =============================================================================
-- OLIMP.ESTIMATE — инициализация PostgreSQL
-- =============================================================================

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";       -- UUID для PK
CREATE EXTENSION IF NOT EXISTS "pg_trgm";          -- триграммный поиск по русским названиям
CREATE EXTENSION IF NOT EXISTS "btree_gin";        -- GIN-индексы для JSONB
CREATE EXTENSION IF NOT EXISTS "unaccent";         -- поиск без учёта регистра/диакритики

-- Русская конфигурация для full-text search
-- (для поиска по сметным позициям типа "арматура а500с диаметр 12")
CREATE TEXT SEARCH CONFIGURATION ru_unaccent (COPY = russian);
ALTER TEXT SEARCH CONFIGURATION ru_unaccent
    ALTER MAPPING FOR hword, hword_part, word
    WITH unaccent, russian_stem;

-- Роль read-only для n8n (чтобы вытаскивать BOQ в ERPNext)
CREATE ROLE oce_readonly LOGIN PASSWORD 'oce_readonly_change_me';
GRANT CONNECT ON DATABASE oce_db TO oce_readonly;
GRANT USAGE ON SCHEMA public TO oce_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO oce_readonly;

-- Часовой пояс для Екатеринбурга
ALTER DATABASE oce_db SET timezone TO 'Asia/Yekaterinburg';
