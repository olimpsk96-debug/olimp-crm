#!/usr/bin/env bash
# Bootstrap скрипт для первого запуска контент-завода
# Запускать из директории olimp-erp/

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "==> Content Factory root: $ROOT"

# 1. Проверка .env.content
if [ ! -f "$ROOT/.env.content" ]; then
    echo "==> .env.content не найден. Копирую из .env.content.example"
    cp "$ROOT/.env.content.example" "$ROOT/.env.content"
    echo "==> ⚠️  Заполни ключи в .env.content перед продолжением"
    echo "    Особенно: ANTHROPIC_API_KEY, WP_USER, WP_APP_PASSWORD, TG_BOT_TOKEN, TG_CHANNEL_ID"
    exit 1
fi

# 2. Загрузить переменные
set -a
. "$ROOT/.env.content"
set +a

# 3. Проверить что docker compose уже стоит
if ! docker compose version >/dev/null 2>&1; then
    echo "❌ docker compose не установлен"
    exit 1
fi

# 4. Проверить сеть olimp_net
if ! docker network ls --format '{{.Name}}' | grep -q "^olimp_net$"; then
    echo "==> Сеть olimp_net не существует. Поднимаю основной стек olimp-erp..."
    cd "$ROOT/.."
    docker compose -f docker-compose.dev.yml up -d
    sleep 5
fi

# 5. Поднять content-factory
echo "==> Поднимаю content-factory стек"
cd "$ROOT/.."
docker compose -f docker-compose.dev.yml -f content-factory/docker-compose.content.yml --env-file content-factory/.env.content up -d --build

# 6. Подождать готовность content-pg
echo "==> Жду готовность content-pg..."
sleep 8

# 7. Применить схему БД
echo "==> Применяю schemas.sql"
docker exec -i content-pg psql -U content -d content < "$ROOT/storage/schemas.sql" || true

# 8. Создать MinIO bucket
echo "==> Создаю MinIO bucket content-factory"
docker exec olimp-minio mc alias set local http://localhost:9000 "${MINIO_ACCESS_KEY:-minio}" "${MINIO_SECRET_KEY:-minio_secret}" 2>/dev/null || true
docker exec olimp-minio mc mb local/content-factory 2>/dev/null || true

# 9. Загрузить нормативку и own_content в Qdrant
echo "==> Сидинг Qdrant: own_content из WP REST API"
docker exec content-pipeline python -m scripts.seed_qdrant_own_content || echo "⚠️  Seed own_content failed — продолжаем"

echo ""
echo "==> ✅ Bootstrap завершён"
echo ""
echo "Проверка:"
echo "  Pipeline:    curl http://localhost:8100/health"
echo "  Postiz UI:   http://localhost:5000"
echo "  ComfyUI:     http://localhost:8188"
echo ""
echo "Первый запуск генерации:"
echo "  docker exec content-pipeline python -m orchestrator.generate_article --topic-id comm_01 --dry-run"
echo ""
