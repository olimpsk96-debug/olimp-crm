# CLAUDE.md — Инструкции для Claude Code

**Этот файл читается Claude Code при каждой сессии. Здесь — правила игры, архитектура, стандарты.**

**Версия 2.0** — после интеграции 5 элементов из ТЗ v2 (AI-ассистент, AI Cashflow, техника, голос, recommendations).

---

## 0. Контекст проекта (главное)

Ты помогаешь разрабатывать **ERP/CRM систему для ООО «Олимп»** — промышленного строительства в Екатеринбурге.

- Главный пользователь — **Дмитрий Клочков, директор**. Это его инструмент.
- Главные боли — **упускаемые тендеры, невидимая маржа, кассовые разрывы**.
- Стек: **ERPNext v15 + Next.js 15 + AI (Claude/OpenAI/Whisper/Qdrant)**
- Дизайн: **Apple-style тёмная тема + светлая (переключатель)**. Числа — главный персонаж. Без эмодзи в UI.

**Цель MVP+:** через 22 недели Дима:
1. Открывает дашборд и за 30 секунд понимает: что горит, где деньги, что требует решения
2. **Спрашивает AI-ассистента голосом** или текстом — получает ответ за 8 секунд с ссылками на источники
3. **Получает рекомендации** на основе паттернов: «закрой КС-2 №3» / «не подавай тендер X» / «продли допуск Y»
4. Видит технику: где, в каком состоянии, когда ТО

---

## 1. Документы, которые ты ОБЯЗАН прочитать перед работой

В корне репозитория лежат:

| Файл | Когда читать |
|------|--------------|
| **ARCHITECTURE.md** | В начале каждой сессии. Понять что строим |
| **SCHEMA_v5.md** | Перед работой с DocType, моделями данных, БД — **это актуальная версия** |
| **MVP_ROADMAP_v3.md** | Чтобы понимать, в какой фазе сейчас (1-8) |
| **AI_ASSISTANT.md** | Перед работой с AI-чатом, RAG, embeddings, Claude/OpenAI API |
| **EQUIPMENT.md** | Перед работой с модулем техники |
| **UI_KIT.md** | Перед любым frontend-коммитом |
| **TELEGRAM_BOT.md** | Перед работой с Telegram-интеграцией |
| **CURRENT_TASK.md** | Каждую сессию — узнать активную задачу |

**HTML-прототипы как design reference** (в корне `/prototypes/`):
- `01_dashboard_director.html` — командный центр
- `02_project_card_v2.html` — карточка проекта
- `03_tenders_pipeline_v2.html` — pipeline тендеров
- `04_estimate_editor.html` — редактор сметы
- `05_gantt_schedule.html` — Gantt-график
- `12_ai_assistant.html` — **AI-чат (главный референс для Фазы 7)**

При создании любого нового frontend-экрана — **открой соответствующий прототип** и следуй паттернам: типографика, отступы, состояния, анимации.

**⚠️ Никогда не пропускай чтение этих файлов.** Не изобретай архитектуру с нуля. Старая SCHEMA_v3/v4 и MVP_ROADMAP/v2 — устарели, **используй только v5/v3**.

---

## 2. Структура репозитория

```
olimp-erp/
├── README.md
├── CLAUDE.md                       # этот файл
├── ARCHITECTURE.md
├── SCHEMA_v5.md                    # ⭐ актуальная схема (46 DocType)
├── MVP_ROADMAP_v3.md               # ⭐ актуальный план (22 недели)
├── AI_ASSISTANT.md                 # 🆕 спецификация AI-ассистента
├── EQUIPMENT.md                    # 🆕 модуль техники
├── UI_KIT.md
├── TELEGRAM_BOT.md
├── CURRENT_TASK.md
├── docker-compose.yml
├── .env.example
├── .env                            # gitignored
│
├── prototypes/                     # 🆕 HTML дизайн-референсы
│   ├── 01_dashboard_director.html
│   ├── 02_project_card_v2.html
│   ├── 03_tenders_pipeline_v2.html
│   ├── 04_estimate_editor.html
│   ├── 05_gantt_schedule.html
│   ├── 12_ai_assistant.html
│   ├── theme.css                   # CSS-переменные dark/light
│   └── theme-switcher.js
│
├── backend/                        # Frappe app
│   └── olimp_construction/
│       └── olimp_construction/
│           ├── doctype/            # все DocType
│           │   ├── tender/
│           │   ├── estimate/
│           │   ├── ks2_act/
│           │   ├── ai_knowledge_document/    # 🆕
│           │   ├── ai_conversation/           # 🆕
│           │   ├── customer_payment_pattern/  # 🆕
│           │   ├── cashflow_forecast_snapshot/ # 🆕
│           │   ├── ai_recommendation/         # 🆕
│           │   ├── ai_pattern/                # 🆕
│           │   ├── equipment/                 # 🆕
│           │   ├── maintenance_log/           # 🆕
│           │   ├── fuel_log/                  # 🆕
│           │   ├── voice_note/                # 🆕
│           │   └── ...
│           ├── api/                # API endpoints
│           │   ├── dashboard.py
│           │   ├── tender.py
│           │   ├── ai/             # 🆕 AI endpoints
│           │   │   ├── chat.py
│           │   │   ├── search.py
│           │   │   ├── embeddings.py
│           │   │   └── voice.py
│           │   ├── cashflow.py     # 🆕
│           │   └── equipment.py    # 🆕
│           ├── ai_services/        # 🆕 AI бизнес-логика
│           │   ├── __init__.py
│           │   ├── llm_client.py   # обёртка над Claude/OpenAI
│           │   ├── embeddings.py   # OpenAI embeddings
│           │   ├── qdrant_client.py # vector DB клиент
│           │   ├── chunking.py     # стратегии разбиения текста
│           │   ├── retrieval.py    # hybrid search + ACL
│           │   ├── reranker.py     # GPT-4o-mini reranking
│           │   ├── system_prompts.py
│           │   ├── cost_tracker.py # учёт расходов на API
│           │   └── recommendations.py # rule-based engine
│           ├── voice_services/     # 🆕 голос
│           │   ├── whisper_client.py
│           │   ├── intent_recognition.py
│           │   └── action_executor.py
│           ├── workflows/
│           ├── print_format/
│           ├── notifications/
│           ├── tasks.py            # cron задачи
│           └── hooks.py
│
├── frontend/                       # Next.js 15
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # Командный центр
│   │   │   ├── tenders/page.tsx
│   │   │   ├── projects/[id]/page.tsx
│   │   │   ├── estimates/[id]/page.tsx  # 🆕
│   │   │   ├── schedule/[id]/page.tsx   # 🆕 Gantt
│   │   │   ├── ks2/page.tsx
│   │   │   ├── cashflow/page.tsx
│   │   │   ├── safety/page.tsx
│   │   │   ├── ai/page.tsx              # 🆕 AI-чат
│   │   │   └── equipment/page.tsx       # 🆕
│   │   └── api/                    # Next.js API routes
│   ├── components/
│   │   ├── ui/                     # shadcn/ui
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── tenders/
│   │   ├── estimates/              # 🆕
│   │   ├── gantt/                  # 🆕
│   │   ├── ai/                     # 🆕 AI-чат компоненты
│   │   │   ├── ChatStream.tsx      # streaming SSE
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── Citation.tsx
│   │   │   ├── SuggestedActions.tsx
│   │   │   ├── VoiceRecorder.tsx
│   │   │   └── SourcesPanel.tsx
│   │   ├── equipment/              # 🆕
│   │   └── shared/
│   │       ├── ThemeSwitcher.tsx   # 🆕 light/dark/auto
│   │       └── ...
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── ai-client.ts            # 🆕 SSE streaming
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useAIChat.ts            # 🆕
│   │   ├── useVoiceRecorder.ts     # 🆕
│   │   └── ...
│   ├── types/
│   ├── styles/globals.css
│   ├── package.json
│   └── tsconfig.json
│
├── n8n/
│   └── workflows/
│       ├── tenderok-sync.json
│       ├── telegram-bot.json
│       ├── telegram-voice-handler.json    # 🆕 voice → Whisper → action
│       ├── bank-import.json
│       ├── ot-tb-alerts.json
│       ├── equipment-alerts.json          # 🆕 ТО, страховка, СРО
│       └── ai-recommendations-engine.json # 🆕 rule-based engine
│
├── qdrant/                         # 🆕 vector database storage
│   └── storage/                    # gitignored, в Docker volume
│
├── nginx/
└── scripts/
    ├── backup.sh
    ├── restore.sh
    ├── deploy.sh
    └── reindex_knowledge.sh        # 🆕 переиндексация AI Knowledge Base
```

---

## 3. Стандарты кода

### 3.1 Python (Frappe app)

```python
# Стиль: PEP 8, type hints обязательны, докстринги в Google style
# Длина строки: 100 символов
# Форматтер: black + isort
# Линтер: ruff

import frappe
from frappe import _
from frappe.utils import now_datetime, getdate, flt

def calculate_project_margin(project_name: str) -> dict:
    """Рассчитывает фактическую маржу проекта.

    Args:
        project_name: имя Project (e.g. "PR-2026-05-12")

    Returns:
        dict с ключами: revenue, cost_actual, margin_pct, margin_amount
    """
    project = frappe.get_doc("Project", project_name)
    # ...
```

**Правила:**
- Никаких raw SQL без явной необходимости. Используем ORM Frappe.
- Все API-методы декорируем `@frappe.whitelist()` и явно проверяем permissions.
- Bulk-операции — через `frappe.db.bulk_insert` / `frappe.db.bulk_update`.
- Cron-задачи в `tasks.py`, регистрируются в `hooks.py`.
- Логи через `frappe.logger().info(...)`, не `print`.

### 3.2 TypeScript / Next.js

```tsx
// Стиль: strict TypeScript, никаких any
// Форматтер: prettier
// Линтер: eslint + typescript-eslint
// Длина строки: 100

// Компоненты:
// - Server Components по умолчанию
// - "use client" только когда нужен state/effects/browser API
// - Названия в PascalCase, файлы тоже
```

**Правила:**
- Типы DocType — генерируем автоматически из Frappe API → `types/`
- Стили — только Tailwind + CSS vars из UI_KIT.md и theme.css. Никаких inline styles, кроме CSS-переменных через `style={{ "--progress": 0.84 }}`
- Серверное состояние — TanStack Query
- Клиентское состояние — Zustand (только для глобального — sidebar collapsed, theme, current AI conversation)
- Формы — react-hook-form + zod валидация
- Анимации — Framer Motion для сложных, CSS — для простых
- **Streaming UI** (AI-чат) — Server-Sent Events через нативный `EventSource` или `fetch` с `ReadableStream`
- **Тёмная/светлая тема** — через `data-theme` атрибут на `<html>` (см. `prototypes/theme.css` как референс)

### 3.3 Naming

| Сущность | Стиль | Пример |
|----------|-------|--------|
| Файлы Python | snake_case | `llm_client.py`, `ai_recommendation.py` |
| Файлы TSX | PascalCase | `ChatStream.tsx`, `EquipmentCard.tsx` |
| Компоненты | PascalCase | `<ChatStream />`, `<VoiceRecorder />` |
| Хуки | camelCase с `use` | `useAIChat()`, `useVoiceRecorder()` |
| Утилиты | camelCase | `formatCurrency()`, `parseCitations()` |
| Типы / интерфейсы | PascalCase | `interface AIMessage { ... }` |
| Константы | SCREAMING_SNAKE | `MAX_TOKENS_PER_REQUEST` |
| API endpoints | snake_case | `get_director_dashboard`, `ai.chat.stream` |
| DocType | Title Case | `AI Knowledge Document`, `Customer Payment Pattern` |
| URL routes | kebab-case | `/ai`, `/equipment/eq-0034` |

---

## 4. Правила работы с DocType

### 4.1 Создание нового DocType

1. **Сначала** обнови SCHEMA_v5.md (yaml-схема)
2. Создай DocType через `bench`:
   ```bash
   bench --site erp.olimp-ural.ru new-doctype "AI Conversation" --module "Olimp Construction"
   ```
3. Поля редактируем в `ai_conversation.json` через Git, не через UI
4. Логика — в `ai_conversation.py`:
   - `validate(self)` — проверки перед сохранением
   - `before_save(self)` — расчёты
   - `on_submit(self)` — действия при submit
   - `on_update_after_submit(self)` — изменения после submit

### 4.2 Расширение стандартного DocType

**Не редактируй стандартные DocType файлы.** Используй Custom Fields через хук, регистрируй в `hooks.py`:
```python
fixtures = ["Custom Field", "Property Setter", "Workflow"]
```

### 4.3 Workflow

State machines — только через стандартный Workflow DocType. Описание схемы — в SCHEMA_v5.md, реализация — JSON-фикстура.

---

## 5. 🆕 Работа с AI API (КРИТИЧНО для Фазы 7)

Это новый блок. Перед любой работой с AI прочитай **AI_ASSISTANT.md**.

### 5.1 LLM-провайдеры и приоритет

```python
# olimp_construction/ai_services/llm_client.py

from anthropic import Anthropic
from openai import OpenAI

class LLMRouter:
    """Маршрутизация запросов между моделями по сложности и стоимости."""

    def __init__(self):
        self.claude = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def route(self, task_type: str) -> tuple[str, str]:
        """Возвращает (provider, model) по типу задачи."""
        return {
            "complex_analysis": ("anthropic", "claude-opus-4-7"),
            "chat_response": ("anthropic", "claude-opus-4-7"),
            "rerank": ("openai", "gpt-4o-mini"),         # дёшево
            "intent_recognition": ("openai", "gpt-4o-mini"),
            "summarization": ("anthropic", "claude-haiku-4-5"),  # быстро+дёшево
            "code_generation": ("anthropic", "claude-opus-4-7"),
        }[task_type]
```

### 5.2 Обязательные правила

1. **Всегда отслеживай стоимость** — каждый вызов LLM записывается в `cost_tracker`:
   ```python
   from olimp_construction.ai_services.cost_tracker import track_llm_call

   response = claude.messages.create(...)
   track_llm_call(
       user=frappe.session.user,
       provider="anthropic",
       model="claude-opus-4-7",
       input_tokens=response.usage.input_tokens,
       output_tokens=response.usage.output_tokens,
       conversation_id=conversation_id
   )
   ```

2. **Лимиты по пользователю** — проверяй до запроса:
   ```python
   if not check_user_daily_limit(user, model):
       raise frappe.ValidationError(_("Дневной лимит AI-запросов исчерпан"))
   ```

3. **Кэширование контекста** — обязательно используй Anthropic prompt caching для system prompt:
   ```python
   response = claude.messages.create(
       model="claude-opus-4-7",
       system=[
           {"type": "text", "text": SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"}}  # экономия 90%
       ],
       ...
   )
   ```

4. **Streaming для UI** — все ответы ассистента возвращаются через SSE:
   ```python
   @frappe.whitelist(allow_guest=False)
   def stream_chat(conversation_id: str, message: str):
       # Возвращаем StreamingResponse через Server-Sent Events
       # Frontend подключается через EventSource
   ```

5. **Fallback стратегия** — если Claude недоступен, fallback на GPT-4o:
   ```python
   try:
       response = claude.messages.create(...)
   except (APIError, RateLimitError):
       response = openai.chat.completions.create(model="gpt-4o", ...)
       frappe.logger().warning("Claude fallback to GPT-4o triggered")
   ```

### 5.3 RAG: правила работы с Knowledge Base

**Чанкинг** — стратегия зависит от типа документа (см. `chunking.py`):
- `Estimate` → 1 chunk = 1 раздел сметы
- `KS2 Act` → весь документ как один chunk
- `Project` → один chunk на проект (целиком)
- `Manual Upload` (PDF) → split по ~1000 токенов с перекрытием 100

**Эмбеддинги** — модель `text-embedding-3-large` (3072 dim), хранятся в Qdrant:
```python
from olimp_construction.ai_services.embeddings import create_embedding

embedding = create_embedding(text, model="text-embedding-3-large")
qdrant_client.upsert(
    collection_name="olimp_knowledge",
    points=[{
        "id": chunk.name,
        "vector": embedding,
        "payload": {
            "doctype": "Estimate",
            "doc_name": estimate.name,
            "access_level": "Internal",  # критично!
            "project": project.name,
            "text": chunk_text,
        }
    }]
)
```

**Hybrid search** — vector similarity + keyword filter + access control:
```python
def search_knowledge(query: str, user: User) -> list[Chunk]:
    query_embedding = create_embedding(query)
    user_levels = get_user_access_levels(user)

    results = qdrant_client.search(
        collection_name="olimp_knowledge",
        query_vector=query_embedding,
        query_filter={
            "must": [
                {"key": "access_level", "match": {"any": user_levels}}
            ]
        },
        limit=20
    )

    # Reranking через GPT-4o-mini → top 5
    top_5 = rerank(query, results, model="gpt-4o-mini")
    return top_5
```

**Контроль доступа КРИТИЧЕН.** Перед любым retrieval — фильтруй по `access_level`:
```python
ACCESS_LEVELS = {
    "Public": ["Public"],
    "Internal": ["Public", "Internal"],
    "Confidential": ["Public", "Internal", "Confidential"],
    "Director Only": ["Public", "Internal", "Confidential", "Director Only"]
}
```

### 5.4 Voice / Whisper

Whisper API — только через `voice_services/whisper_client.py`:
```python
from olimp_construction.voice_services import transcribe

voice_note = frappe.get_doc("Voice Note", name)
result = transcribe(
    audio_file_path=voice_note.audio_file,
    language="ru",
    model="whisper-large-v3"
)
voice_note.transcription_text = result.text
voice_note.transcription_confidence = result.confidence
voice_note.save()

# Затем — intent recognition через Claude:
intent = recognize_intent(result.text, user_role=user.role)
if intent.type == "Foreman Report":
    create_foreman_report_from_voice(voice_note, intent.entities)
```

### 5.5 AI Recommendation Engine

Паттерны (правила) хранятся в `AI Pattern` DocType. Engine запускается **раз в час** через cron:

```python
# olimp_construction/tasks.py

def run_ai_recommendation_engine():
    """Запускает все активные паттерны и создаёт рекомендации."""
    for pattern in frappe.get_all("AI Pattern", filters={"is_active": 1}):
        pattern_doc = frappe.get_doc("AI Pattern", pattern.name)
        try:
            execute_pattern(pattern_doc)
        except Exception as e:
            frappe.log_error(f"Pattern {pattern.name} failed: {e}")
```

**Никогда не создавай новый паттерн без согласования с Димой** — каждое правило это сообщение пользователю.

---

## 6. Frontend: AI-чат

### 6.1 Streaming через SSE

```tsx
// hooks/useAIChat.ts
"use client";

export function useAIChat(conversationId: string) {
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);

  const sendMessage = async (text: string) => {
    setStreaming(true);
    const eventSource = new EventSource(
      `/api/ai/chat/stream?conversation_id=${conversationId}&message=${encodeURIComponent(text)}`
    );

    let accumulated = "";
    eventSource.onmessage = (event) => {
      const chunk = JSON.parse(event.data);
      if (chunk.type === "delta") {
        accumulated += chunk.text;
        setMessages(prev => [
          ...prev.slice(0, -1),
          { ...prev[prev.length - 1], content: accumulated }
        ]);
      }
      if (chunk.type === "done") {
        setStreaming(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setStreaming(false);
      eventSource.close();
    };
  };

  return { messages, streaming, sendMessage };
}
```

### 6.2 Citations

В UI каждый ответ AI содержит маркеры `[1]`, `[2]` с переходом на источник:
```tsx
function MessageContent({ text, sources }: Props) {
  // Парсим [N] и заменяем на компонент Citation
  return parseAndRenderCitations(text, sources);
}
```

### 6.3 Voice input

Используй MediaRecorder API + загрузку в Frappe:
```tsx
const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
recorder.ondataavailable = async (e) => {
  const formData = new FormData();
  formData.append("file", e.data, "voice.webm");
  await fetch("/api/method/upload_file", {
    method: "POST",
    body: formData,
    credentials: "include"
  });
};
```

---

## 7. 🆕 Работа с Equipment (Фаза 8)

Перед работой прочитай **EQUIPMENT.md**.

### 7.1 Категории техники

Шесть категорий, каждая со своей спецификой:
- Подъёмники → требуют **СРО** (раз в год!)
- Промальп оборудование → требует **поверки** (раз в год!)
- Окрасочное (АКЗ) → требует регулярной чистки
- Бетонные работы → быстрая амортизация
- Сварочное → калибровка
- Грузовая техника → ОСАГО, техосмотр, налоги

### 7.2 Алерты (cron daily)

```python
# tasks.py

def check_equipment_alerts():
    """Daily cron: проверяем сроки ТО, страховок, СРО."""
    today = frappe.utils.getdate()

    for equip in frappe.get_all("Equipment", filters={"status": ["!=", "Списана"]}):
        equip_doc = frappe.get_doc("Equipment", equip.name)

        # ТО через 7 дней
        if equip_doc.next_maintenance_date == today + timedelta(days=7):
            create_recommendation(
                type="Equipment Maintenance",
                target=equip_doc,
                title=f"ТО {equip_doc.equipment_name} через 7 дней",
                urgency="Medium"
            )

        # СРО через 30 дней
        if equip_doc.sro_certificate_date == today + timedelta(days=30):
            send_telegram_alert(director, f"Продли СРО на {equip_doc.equipment_name}")
```

### 7.3 Расчёт TCO

Стоимость владения за период — через метод DocType:
```python
# equipment.py

class Equipment(Document):
    def calculate_total_cost_of_ownership(self, period_months=12):
        """См. EQUIPMENT.md раздел 5."""
        depreciation = self.purchase_price * (self.depreciation_rate_pct / 100) * (period_months / 12)
        maintenance = sum(...)
        fuel = sum(...)
        # ...
        return {"total": ..., "breakdown": {...}}
```

---

## 8. Принципы коммуникации со мной (Димой)

1. **Сначала уточнения, потом код.** Если задача неоднозначна — задай 1-3 ключевых вопроса.

2. **Опасные операции — спрашивай.** Любое:
   - Удаление БД, файлов, таблиц
   - Изменение прав / Workflow на production
   - Деплой
   - Миграции данных
   - Установка новых зависимостей с major-обновлением
   - **🆕 Изменение system prompt AI-ассистента**
   - **🆕 Изменение AI Pattern (правил рекомендаций)**
   - **🆕 Индексация документов с access_level "Confidential" или "Director Only"**
   - **🆕 Изменение лимитов AI-бюджета**

3. **Большие изменения — план перед реализацией.** Если задача больше 100 строк кода — сначала покажи план, потом пиши.

4. **Промежуточные результаты.** Длинные задачи (> 30 мин) — рассказывай о прогрессе.

5. **Коммиты по смыслу.** Не один гигантский — а отдельные осмысленные:
   - `feat(estimate): add Estimate Item Resource child DocType`
   - `feat(ai): implement RAG retrieval with access control`
   - `fix(equipment): correct TCO calculation for period < 12 months`
   - Conventional Commits: `feat | fix | refactor | docs | test | chore | style`

6. **Тесты.** Для каждой нетривиальной бизнес-логики — pytest на Python, vitest на TS. Покрытие > 60% для бэкенда. **Для AI-кода — eval suite с тестовым набором запросов** (см. AI_ASSISTANT.md раздел 9).

7. **Не ленись с типами.** TypeScript — `strict: true`. Python — type hints везде, проверяй mypy.

---

## 9. Безопасность

❌ **НИКОГДА:**
- Не коммить .env, секреты, API-ключи (включая `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)
- Не использовать `frappe.db.sql` без параметризации (SQL-инъекции)
- Не отключать CSRF
- Не доверять данным с фронта без валидации на бэке
- Не логировать пароли, токены, персональные данные
- **🆕 Не отправлять в LLM API данные с access_level "Director Only"** без явного согласия Димы
- **🆕 Не индексировать в Knowledge Base зарплаты, договоры с поставщиками с особыми условиями** без ACL
- **🆕 Не сохранять voice recordings дольше 30 дней** (после транскрипции — удалять)

✅ **ВСЕГДА:**
- В API проверять `frappe.has_permission()`
- Загружаемые файлы валидировать (тип, размер, scan на вирусы для PDF)
- Внешние API — через секреты в .env, не хардкодить
- Backups — ежедневно, проверять восстанавливаемость раз в месяц
- **🆕 AI-вызовы логировать в `AI Conversation Message`** (audit trail на 2 года)
- **🆕 Проверять `access_level` при retrieval** — пользователь не должен видеть чужие данные
- **🆕 Costs tracker должен работать** — без него лимиты не сработают

---

## 10. Что нельзя без согласования с Димой

- Менять архитектурные решения из ARCHITECTURE.md (ADR)
- Добавлять новые зависимости (npm/pip)
- Менять UI_KIT.md (палитру, шрифты, базовые компоненты)
- Менять theme.css (это переключатель тем для всех экранов)
- Деплоить на production
- Удалять / переименовывать DocType
- Изменять формат КС-2/КС-3 PDF (это юридический документ!)
- Менять права пользователей
- **🆕 Менять system prompt AI-ассистента** (определяет поведение системы)
- **🆕 Создавать / отключать AI Pattern** (каждое правило = пуш-уведомление пользователю)
- **🆕 Менять лимиты AI-бюджета** (риск финансовых сюрпризов)
- **🆕 Индексировать новые типы документов в Knowledge Base** (риск утечки данных)
- **🆕 Менять модели LLM** (Opus → Sonnet и т.п. — влияет на качество и цену)

---

## 11. Какие фичи приоритетны (помни!)

В порядке убывания, по результатам интервью + развитие на v5:

1. 🔴 **Тендеры** — pipeline, дедлайны, Telegram-алерты, AI-оценка (Фаза 1)
2. 🔴 **Маржа по проектам** — реальная, по факту, в реальном времени (Фаза 2)
3. 🔴 **Сметы как ядро** — импорт из Гранд-Сметы, ресурсная часть (Фаза 2)
4. 🟠 **Склад + Снабжение** — заявка → заказ → склад с автосписанием (Фаза 3)
5. 🟠 **КС-2/КС-3** — быстрая генерация, согласование с мобильного (Фаза 4)
6. 🟠 **Cashflow + AI прогноз** — Customer Payment Pattern + Forecast (Фаза 5)
7. 🟡 **Графики работ + CPM** — Gantt + критический путь (Фаза 5)
8. 🟡 **Прорабы + ОТ/ТБ + Голос** — Telegram + Whisper (Фаза 6)
9. 🆕 🟢 **AI-ассистент с RAG** — главная новая фича MVP+ (Фаза 7)
10. 🆕 🟢 **AI Recommendations** — конкретные действия для директора (Фаза 7)
11. 🆕 🟢 **Управление техникой** — Equipment + ТО + ГСМ (Фаза 8)

Если выбираешь между двумя задачами — приоритет выше у той, что ближе к началу списка.

---

## 12. Стиль ответов мне

- **Без воды.** Не "давайте я сейчас расскажу..." — сразу к делу.
- **Технические детали — кратко.** Дима — технически грамотный, не нужно объяснять, что такое API, RAG, embeddings, JWT.
- **Покажи результат.** Если сделал — выведи итог. Не "я создал файл" — а "создан `ai_conversation.py`, основные методы: `send_message()`, `get_context()`, `track_cost()`".
- **Русский язык.** UI, документы, переписка с Димой — на русском. Код, переменные, логи — английский (стандарт).
- **Числа форматируй красиво** — `52,8 млн ₽`, не `52800000` в тексте.
- **🆕 AI-стоимость показывай явно** — «вызов Claude Opus = ~12 ₽ за этот ответ», чтобы было прозрачно.

---

## 13. Когда что-то не работает

1. Прочитай ошибку до конца, не торопись
2. Проверь логи: `docker logs olimp_backend --tail 100`
3. Проверь Frappe error log: `bench --site ... show-error-log`
4. **🆕 Для AI-проблем:** проверь `AI Conversation` логи — что искалось, что нашлось, что отвечала модель
5. **🆕 Для Qdrant:** `curl http://localhost:6333/collections/olimp_knowledge` — проверь что коллекция жива
6. **🆕 Для cost overrun:** `cost_tracker.get_user_today(user)` — может быть упёрлось в лимит
7. Если упорно не работает — расскажи Диме что пробовал, не закапывайся часами молча
8. Не добавляй костыли. Если решение выглядит как костыль — значит, упускаешь что-то фундаментальное

---

## 14. AI-разработка: специальные правила

### 14.1 Промпт-инжиниринг

- **Никогда не правь system prompt в одиночку.** Это сильно влияет на поведение системы.
- **Все изменения — через A/B тест** на eval suite (50 типичных запросов директора).
- **Версионируй prompts** — храни в `system_prompts.py` как константы с версиями.

### 14.2 Cost optimization

- **Всегда сначала проверь — может GPT-4o-mini справится?** Он в 10× дешевле Opus.
- **Кэшируй embeddings** — один и тот же текст → одно и то же embedding (используй hash).
- **Лимит истории диалога** — последние 4 сообщения, не вся история. История > 20 сообщений → новый conversation с переносом контекста.
- **Rate limit** — 1 запрос/сек на пользователя.

### 14.3 Контроль качества AI

Регулярно проверяй:
1. **Точность** — на тестовом наборе из 50 типичных запросов
2. **Hallucination rate** — выдумывает ли AI цифры, которых нет в источниках
3. **Latency p95** — < 8 секунд (TTFT < 1.5 сек)
4. **Cost per response** — среднее < 5 ₽

Если метрики просели — алерт Диме.

---

## 15. Текущая фаза

Перед каждой сессией смотри `CURRENT_TASK.md`. Там:
- Текущая фаза (0-8)
- Активная задача
- Блокеры
- Что сделать следующим

**Если CURRENT_TASK.md устарел или пустой — спроси Диму, чем заняться.**

Доступные фазы (актуально для v5):
- **Фаза 0** — Инфраструктура (Selectel + Docker)
- **Фаза 1** — Тендеры (pipeline + AI score)
- **Фаза 2** — Сметы как ядро (Estimate + Work Standard)
- **Фаза 3** — Склад + Снабжение (Material Request + auto-writeoff)
- **Фаза 4** — КС-2 / КС-3 (быстрая генерация)
- **Фаза 5** — Графики + AI Cashflow (Gantt + Customer Payment Pattern)
- **Фаза 6** — Прорабы + ОТ/ТБ + Голос (Telegram + Whisper)
- **🆕 Фаза 7** — **AI-ассистент** (RAG + Recommendations)
- **🆕 Фаза 8** — **Техника** (Equipment + ТО + ГСМ)
- **Фаза 9** — Пилот на НПП Старт
- **Фаза 10+** — Production rollout, каталоги, ЭДО, портал

---

## 16. Ссылки на критичные файлы (быстрая навигация)

| Что нужно | Где |
|-----------|-----|
| Все DocType со схемой | `SCHEMA_v5.md` |
| План работ и часы | `MVP_ROADMAP_v3.md` |
| Спецификация AI | `AI_ASSISTANT.md` |
| Спецификация техники | `EQUIPMENT.md` |
| UI Kit (цвета, шрифты, компоненты) | `UI_KIT.md` |
| Дизайн-референсы (HTML) | `prototypes/` |
| Telegram-бот | `TELEGRAM_BOT.md` |
| Архитектурные решения | `ARCHITECTURE.md` |
| Текущая задача | `CURRENT_TASK.md` |

---

## 17. Чеклист перед коммитом

- [ ] Тесты прошли (`pytest`, `npm test`)
- [ ] Линтер чист (`ruff`, `eslint`)
- [ ] Типы корректны (`mypy`, `tsc --noEmit`)
- [ ] Нет хардкоженных секретов
- [ ] **🆕 Если код вызывает LLM — есть `track_llm_call`**
- [ ] **🆕 Если есть retrieval — проверяется `access_level`**
- [ ] **🆕 Если новый DocType — обновлена SCHEMA_v5.md**
- [ ] **🆕 Если новый кастомный экран — соответствует прототипу из `prototypes/`**
- [ ] Conventional commit message
- [ ] Если меняется API — обновлён README или OpenAPI

---

## 18. Что менялось от версии к версии

| Версия CLAUDE.md | Дата | Главное изменение |
|------------------|------|-------------------|
| v1.0 | первая версия | Базовые правила, ERPNext + Next.js |
| **v2.0** | **после ТЗ v2** | **+ AI-ассистент, + техника, + голос, + recommendation engine** |

Когда обновляешь CLAUDE.md — добавляй запись в эту таблицу.
