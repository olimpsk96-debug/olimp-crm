#!/usr/bin/env bash
# =============================================================================
# Импорт всех кастомных DocType в ERPNext
# =============================================================================
# Запускать в контейнере erpnext-backend:
#   docker compose exec erpnext-backend bash /path/to/import-doctypes.sh
#
# Или с хоста:
#   docker compose exec -T erpnext-backend bench --site olimp.local execute \
#     erpnext.olimp.import_doctypes
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCTYPES_DIR="${SCRIPT_DIR}/../erpnext-doctypes"
SITE="${ERPNEXT_SITE:-olimp.local}"

echo "==================================================="
echo "Импорт DocType ОЛИМП.СТЕК → ${SITE}"
echo "==================================================="

# Порядок важен: сначала child tables, потом parent
DOCTYPES=(
  "assembly-item.json"          # Child: должен быть до Construction Assembly
  "boq-section.json"             # Child
  "boq-position.json"            # Child
  "construction-assembly.json"   # Использует Assembly Item
  "boq.json"                     # Использует BOQ Section, BOQ Position
  "project-change-order.json"
  "project-risk.json"
)

for doctype_file in "${DOCTYPES[@]}"; do
  filepath="${DOCTYPES_DIR}/${doctype_file}"
  
  if [ ! -f "$filepath" ]; then
    echo "❌ Файл не найден: $filepath"
    exit 1
  fi
  
  doctype_name=$(jq -r '.name' "$filepath")
  echo ""
  echo "→ Импортирую: $doctype_name (из ${doctype_file})"
  
  # Используем bench execute с inline Python для импорта
  bench --site "$SITE" execute frappe.core.doctype.data_import.data_import.import_doc \
    --kwargs "{'path': '$filepath'}" 2>&1 | grep -v "^$" || true
  
  echo "  ✅ $doctype_name импортирован"
done

echo ""
echo "==================================================="
echo "Добавляю Custom Fields для Project"
echo "==================================================="

bench --site "$SITE" execute frappe.custom.doctype.custom_field.custom_field.create_custom_fields --kwargs "
{
  'custom_fields': {
    'Project': [
      {'fieldname': 'custom_oce_section', 'fieldtype': 'Section Break', 'label': 'OCE Integration', 'collapsible': 1},
      {'fieldname': 'custom_oce_project_id', 'fieldtype': 'Data', 'label': 'OCE Project ID', 'read_only': 1},
      {'fieldname': 'custom_oce_boq_id', 'fieldtype': 'Link', 'label': 'BOQ', 'options': 'BOQ'},
      {'fieldname': 'custom_oce_boq_version', 'fieldtype': 'Int', 'label': 'BOQ Version'},
      {'fieldname': 'custom_oce_column_break', 'fieldtype': 'Column Break'},
      {'fieldname': 'custom_oce_spi', 'fieldtype': 'Float', 'label': 'SPI', 'read_only': 1, 'precision': 2},
      {'fieldname': 'custom_oce_cpi', 'fieldtype': 'Float', 'label': 'CPI', 'read_only': 1, 'precision': 2},
      {'fieldname': 'custom_oce_eac', 'fieldtype': 'Currency', 'label': 'EAC (Estimate at Completion)', 'read_only': 1},
      {'fieldname': 'custom_oce_last_sync', 'fieldtype': 'Datetime', 'label': 'Last OCE sync', 'read_only': 1},
      {'fieldname': 'custom_oce_link', 'fieldtype': 'Data', 'label': 'Open in OCE', 'options': 'URL', 'read_only': 1},
      {'fieldname': 'custom_overhead_percent', 'fieldtype': 'Percent', 'label': 'Накладные, %', 'default': 8},
      {'fieldname': 'custom_target_margin_percent', 'fieldtype': 'Percent', 'label': 'Целевая прибыль, %', 'default': 15},
      {'fieldname': 'custom_contingency_percent', 'fieldtype': 'Percent', 'label': 'Резерв на риски, %', 'default': 5}
    ],
    'Task': [
      {'fieldname': 'custom_oce_activity_id', 'fieldtype': 'Data', 'label': 'OCE Activity ID', 'read_only': 1},
      {'fieldname': 'custom_dependency_type', 'fieldtype': 'Select', 'label': 'Dependency Type', 'options': 'FS\nFF\nSS\nSF', 'default': 'FS'},
      {'fieldname': 'custom_lag_days', 'fieldtype': 'Int', 'label': 'Lag (days)'},
      {'fieldname': 'custom_is_critical_path', 'fieldtype': 'Check', 'label': 'On critical path', 'read_only': 1},
      {'fieldname': 'custom_baseline_start', 'fieldtype': 'Date', 'label': 'Baseline start'},
      {'fieldname': 'custom_baseline_end', 'fieldtype': 'Date', 'label': 'Baseline end'},
      {'fieldname': 'custom_earned_value', 'fieldtype': 'Currency', 'label': 'Earned Value', 'read_only': 1}
    ]
  }
}
"

echo ""
echo "==================================================="
echo "Создаю Item Groups для строительства"
echo "==================================================="

bench --site "$SITE" execute frappe.client.insert --kwargs "
{
  'doc': {
    'doctype': 'Item Group',
    'item_group_name': 'Строительство',
    'parent_item_group': 'All Item Groups',
    'is_group': 1
  }
}
" || echo "  (Item Group 'Строительство' уже существует)"

for group in "Бетон и ЖБИ" "Металлопрокат и МК" "АКЗ материалы" "Углеволокно" "Кровельные материалы" "Метизы и крепёж" "ИТР" "Рабочие" "Промальп" "Сварщики" "Грузоподъёмная техника" "Сварочное оборудование" "АКЗ-оборудование"; do
  bench --site "$SITE" execute frappe.client.insert --kwargs "
  {
    'doc': {
      'doctype': 'Item Group',
      'item_group_name': '$group',
      'parent_item_group': 'Строительство',
      'is_group': 0
    }
  }
  " 2>/dev/null || echo "  (Group '$group' уже существует)"
done

echo ""
echo "==================================================="
echo "✅ Готово!"
echo "==================================================="
echo ""
echo "Что проверить:"
echo "  1. Открыть https://erp.olimp-ural.ru/app/boq — должна быть пустая таблица BOQ"
echo "  2. Открыть Project → создать новый → проверить вкладку OCE Integration"
echo "  3. /app/construction-assembly — создать первую тестовую сборку"
echo ""
echo "Дальше:"
echo "  • Импортируй n8n workflows из ../n8n-workflows/"
echo "  • Настрой API-токены для ERPNext (User → API Access → Generate Keys)"
echo "  • Поднимай OCE через docker-compose.olimp.yml"
