#!/bin/bash
# Устанавливает зависимости olimp_construction при старте контейнера
set -e

REQUIREMENTS="/home/frappe/frappe-bench/apps/olimp_construction/requirements.txt"
PIP="/home/frappe/frappe-bench/env/bin/pip"

if [ -f "$REQUIREMENTS" ]; then
    echo "[entrypoint] Устанавливаем зависимости olimp_construction..."
    $PIP install -r "$REQUIREMENTS" -q
    echo "[entrypoint] Зависимости установлены."
fi

exec "$@"
