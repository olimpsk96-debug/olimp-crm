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

## 0.1 Как запускать Claude Code в этом проекте

```bash
claude --permission-mode auto
```

Режим `auto` автоматически разрешает все tool calls (Bash, Edit, Write, миграции Frappe) — Дима не хочет тратить время на подтверждения для каждого действия.

**Что это значит для тебя:**
- Не спрашивай разрешения на отдельные операции — выполняй сразу
- При деструктивных действиях (rm -rf, drop table, force-push, удаление DocType) — всё равно сначала **спроси у Димы**, режим auto не отменяет здравый смысл
- Команды миграций (`bench migrate`), рестарты контейнеров, правки кода — выполняй без вопросов

---

## 0.2 Параллельная работа через субагентов

Для ускорения используй subagents — это даёт **2-4x скорость** на независимых задачах.

**Когда запускать параллельно:**
- Аудит/инвентаризация — несколько Explore-агентов на разные модули в одном сообщении
- Независимые фиксы багов — каждому general-purpose-агенту своя изолированная задача с конкретными файлами
- Архитектура крупных фич — один Plan-агент (Opus) пока ты делаешь подготовку

**Когда НЕ запускать параллельно:**
- Связанные правки одного файла (конфликт)
- Задачи, требующие результат предыдущей (последовательность)
- Мелочи на 5 минут (накладные расходы > выгоды)

**Правила:**
- Делай 2-4 параллельных агента в одном сообщении (не больше — труднее синтезировать)
- Каждому давай ясный, изолированный scope с конкретными файлами
- После сбора всех отчётов — сам синтезируй и принимай решения
- Параллельная работа на разных страницах frontend — безопасно
- Параллельная работа на разных DocType backend — безопасно
- НЕ запускай агентов которые могут редактировать одни и те же файлы

## 0.3 Выбор модели по сложности

Использую разные модели для разных задач:

| Задача | Модель | Почему |
|--------|--------|--------|
| Аудит/инвентаризация/поиск файлов | **Haiku** (Explore agents по умолчанию) | Быстро, дёшево |
| Архитектура крупной фичи, ADR-решения | **Opus** (Plan agent) | Качество стратегического мышления |
| Реализация (код, фиксы) | **Sonnet** (основной) | Баланс качества и скорости |
| Простые рефакторинги, форматирование | **Sonnet** (или general-purpose) | Достаточно для механики |
| AI-ассистент пользователю (production) | **Haiku 4.5** | Дёшево, быстро, для diaglog |
| AI-оценка тендеров (production) | **Haiku 4.5** | Single-prompt задача |
| AI глубокий анализ маржи (production) | **Sonnet 4.6** | Когда нужно качество |

**Не используй Opus в production** для пользовательских AI-функций — слишком дорого. Только для разработки и архитектуры.

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

## 18. Известные подводные камни (история багов и уроков)

**Правило:** После каждого исправления ошибки/бага — обязательно добавить запись сюда. Это страховка, чтобы один и тот же баг не повторялся в будущем (особенно когда подключается другой ассистент или сессия).

Формат: `### Дата — Краткое название` → 1-3 строки сути (что сломалось, почему, как починили).

### 2026-05-11 — `Customer.territory` требует существующий Link
В Frappe поле `Customer.territory` — `Link → Territory`, и валидация падает если территория не существует в БД. По умолчанию ERPNext **не создаёт** "Russia". В `save_client()` нужно использовать `frappe.db.get_value("Territory", {"name": "All Territories"}, "name")` как fallback. То же для `customer_group` (использовать существующую группу из БД, не хардкодить "Commercial" — она может отсутствовать).

### 2026-05-12 — Поля сметы `Estimate` называются `base_total`/`our_total`, не `total_cost`/`total_price`
В нашем `Estimate` DocType итоговые суммы хранятся в полях `base_total` (сумма по нормам), `our_total` (наша цена), `margin_pct`, `margin_amount`. **Нет полей** `total_cost` или `total_price`. При обращении к смете из других API использовать `getattr(est, "base_total", 0)` или прямые названия полей. Проверять `*.json` DocType перед написанием API.

### 2026-05-12 — Конфликт имён: ERPNext уже имеет `Project` DocType
ERPNext поставляется со стандартным DocType `Project` (модуль "Projects"). Если создать свой `Project` — будет коллизия. Наш кастомный DocType называется **`Construction Project`** (autoname `PR-.YYYY.-.####`). Все Link-поля в Tender, Estimate, KS2 Act, Material Request, Foreman Report, Safety Incident, Equipment, Fuel Log указывают на `Construction Project`, не на `Project`. При создании новых DocType со стандартными именами (`Customer`, `Item`, `Project`, `Employee` и т.п.) — **всегда префиксовать** или проверять `frappe.db.exists("DocType", "X")` перед созданием.

### 2026-05-11 — `frappe.get_doc("Customer", {...dict})` не работает через `bench execute`
Через `bench --site ... execute frappe.get_doc --args` нельзя передать dict для создания документа (происходит TypeError). Для создания тестовых данных:
- либо `bench execute olimp_construction.api.crm.save_client --kwargs '{"data": {...}}'`
- либо `bench execute frappe.db.sql --args '["INSERT INTO ..."]'` (быстрый seed без валидаций)

### 2026-05-12 — `TenderLaw`: рассинхрон фронта и бэка («Прямой договор» vs «Коммерческий»)
В `frontend/types/tender.ts` был тип `TenderLaw = ... | "Прямой договор"`, тогда как `tender.json` DocType и `api/tender.py` (функция `create_from_tenderguru`, константа `VALID_LAWS`) используют `"Коммерческий"`. В рантайме это приводило бы к молчаливому несовпадению: бэк отдавал бы `"Коммерческий"`, фронт ожидал `"Прямой договор"`. **Правило:** единым источником истины для enum-полей служит `options` в `*.json` DocType. При добавлении/изменении Select-полей — синхронизируй `*.json` → backend константы (`VALID_*`) → frontend types за один коммит.

### 2026-05-12 — Дублирование `STATUSES_ACTIVE` в 3 файлах
Список активных статусов тендера `("Новый", "Оценивается", "Готовится заявка", "Заявка подана")` был задублирован в `telegram_utils.py` (без "Заявка подана"!), `api/dashboard.py` и `api/crm.py`. Из-за этого в Telegram-алертах о дедлайнах **тендеры со статусом «Заявка подана» не учитывались**. Исправлено: единая константа `STATUSES_ACTIVE` живёт в `olimp_construction/telegram_utils.py`, остальные модули импортируют её через `from olimp_construction.telegram_utils import STATUSES_ACTIVE`. **Правило:** доменные константы (списки статусов, enum-значения) — в одном месте; перед добавлением нового места поиска используй `grep -rn "<статус>" backend/` чтобы найти существующую константу.

### 2026-05-13 — `custom_fields` в hooks.py НЕ применяется при `bench migrate` автоматически
В Frappe словарь `custom_fields` в `hooks.py` сам по себе ничего не делает — это просто данные. Custom Fields подгружаются либо из **fixtures** (export → JSON в `fixtures/custom_field.json`), либо нужен явный hook `after_install` / `after_migrate` который вызывает `frappe.custom.doctype.custom_field.custom_field.create_custom_fields(custom_fields)`. **Правило:** при добавлении нового Custom Field в `hooks.py` обязательно проверить что у нас зарегистрирован `after_migrate = ["olimp_construction.install.sync_custom_fields"]` — иначе поля «вроде есть в коде», но реально на DocType их нет.

### 2026-05-13 — `doc_events["Project"]` ≠ наш `Construction Project`
В hooks.py было `doc_events: {"Project": {"on_update": ...}}`, но мы не используем стандартный ERPNext `Project`, у нас собственный `Construction Project`. Хук молча не срабатывал. **Правило:** при добавлении doc_events перепроверять через `frappe.db.exists("DocType", X)` или ища Link-references — какой DocType реально используется в проекте, не угадывать по «общему смыслу».

### 2026-05-13 — Material Request: статусы «Заказана/Получена» НЕ существуют
В DocType реально: «Черновик / Отправлена / Одобрена / Закупается / Получена / Отменена». Если в SQL пишешь WHERE status IN (...) — копируй опции прямо из `*.json` через `grep '"options"'`, не угадывай. Cost-расчёт по проекту учитывает {Одобрена, Закупается, Получена} как committed cost (см. `tasks.recalculate_project_margin` и `api.project.get_list`).

### 2026-05-13 — Child DocType `before_save` срабатывает не всегда
В Frappe `before_save` на child DocType (istable=1) **не вызывается надёжно** при `parent.insert()` через `frappe.get_doc({..., "items": [...]})` со словарями. **Правило:** все расчёты для строк (qty × unit_price = amount, и т.п.) делать в `before_save` **родительского** документа, итерируя `for it in self.items: it.amount = ...`. Был баг в Change Order — поправлено в `change_order.py`.

### 2026-05-13 — DocType требует и `.json`, и `.py` модуль (даже пустой)
Создание `cost_catalog_item.json` без рядом стоящего `cost_catalog_item.py` приводит к `ImportError: Module import failed for Cost Catalog Item, the DocType you're trying to open might be deleted. No module named '...doctype.cost_catalog_item.cost_catalog_item'`. **Правило:** при создании нового DocType всегда создавать **оба** файла: `.json` (метаданные) **и** `.py` (с пустым `class XYZ(Document): pass`). Иначе `bench migrate` пройдёт, но любое обращение через ORM упадёт.

### 2026-05-13 — Telegram `parse_mode="HTML"` по умолчанию + `*Markdown*` в текстах
`send_message()` в `telegram_utils.py` отправляет с `parse_mode="HTML"`. Если в тексте есть `*звёздочки*` (markdown-bold) — они **не** распознаются и отображаются как литералы. Правило: используем `<b>…</b>` для bold, `<i>…</i>` для italic. Был баг в `check_crm_followups` — исправлен.

### 2026-05-13 — `frappe.get_all(order_by="CASE WHEN ...")` падает с `Illegal SQL Query`
Frappe валидирует ORDER BY через `validate_order_by_and_group_by` (`frappe/model/db_query.py`) — запрещены `CASE WHEN`, `FIELD()` и любые выражения сложнее простого `field [asc|desc]`. Если нужен кастомный порядок (пр. в `punchlist.get_list`: сначала просроченные, потом «Критично» сверху) — пиши `frappe.db.sql("""... ORDER BY CASE WHEN due_date < %(today)s ... END""", {"today": today}, as_dict=True)` с параметризацией. **Кэш модулей:** после правки `.py` в `api/` нужен `docker restart olimp_backend` (gunicorn-воркеры держат старый импорт; `bench clear-cache` НЕ помогает, он чистит метаданные, а не Python-модули).

### 2026-05-13 — Гранд-Смета XML: windows-1251 на фронте + реальный формат GS v12
**Файл сметы из Гранд-Сметы — в кодировке windows-1251.** `file.text()` в браузере декодирует как UTF-8 → русские строки превращаются в мусор. Правило: для XML импорта из GS читать через `arrayBuffer()` + детект encoding из declaration + `new TextDecoder("windows-1251")` (см. `EstimateDrawer.tsx` `handleImportXml`).

**Реальный формат GrandSmeta v12.x не похож на «общий XML».** Названия — в атрибуте `Caption` (не `Name`/`Title`), единица — `Units` (не `Unit`), объём с формулами — берём из дочернего `<Quantity Result="..."/>` (атрибут `Quantity` может содержать `100/1000` или `=ОКР(700; 2)`), цена — из `<PriceBase PZ="..."/>` (это ПЗ в ценах **2001 года**), а **актуальная цена = PZ × SMR-index** из `<Indexes><IndexesPos><Index SMR="..."/></IndexesPos></Indexes>`. Также есть `<AddZatrats>` — там понижающий договорной коэффициент с `Options="…AsKf"` (применяется к our_unit_price) и НДС с `Options="…Inactive"` (игнорируется на уровне Estimate). `<Header/>` — пустой разделитель, пропускать. **Правило:** при импорте новых внешних форматов сначала смотреть реальный XML/JSON клиента, потом писать парсер — общие шаблоны "Name/Title/Amount" почти никогда не угадывают.

### 2026-05-12 — Material Request: статус «Получено» vs «Получена»
В `material_request.json` (options) и `api/supply.py` (VALID_STATUSES), `types/supply.ts`, `supply/page.tsx`, `SupplyDrawer.tsx` стоял мужской род «Получено», а в `api/project.py` (SQL-запрос и фильтр на стороне Python) использовался женский род «Получена». Заявка (Material Request) — женского рода, поэтому корректное значение — **«Получена»**. Из-за рассинхрона `api/project.py` молча выдавал supply_total=0 (статус с женским родом не существовал в БД). Приведено к «Получена» во всех 6 местах. **Внимание:** label `"Получено"` в `ks2_act.json` (поле `payment_received`) — это другой контекст («получено денег»), его не трогаем. **Правило:** грамматический род в Select-options должен соответствовать роду DocType; меняй централизованно через `*.json` + grep по проекту.

### 2026-05-13 — `docker compose stop && up -d` пересоздаёт backend без CMD → крэш-loop
В `docker-compose.yml` для сервиса `backend` был задан только `entrypoint: ["/scripts/docker-entrypoint-backend.sh"]` без `command:`. Образ `frappe/erpnext:v15` имеет собственный CMD = `gunicorn ...frappe.app:application`, но **при `docker compose up -d` контейнер пересоздаётся по compose-конфигу, и CMD из образа не наследуется** (т.к. entrypoint переопределён). Получается `exec "$@"` в нашем скрипте запускает пустоту → контейнер выходит с кодом 0 → `restart: unless-stopped` бесконечно перезапускает. Раньше работало, потому что контейнер был создан давно с правильным CMD, и `docker restart` его не пересоздавал. **Решение:** в `docker-compose.yml` сервис `backend` теперь имеет явный `command:` со всей строкой gunicorn (`--bind=0.0.0.0:8000 --workers=2 --threads=4 --worker-class=gthread --timeout=120 --preload frappe.app:application`). **Правило:** если используется кастомный `entrypoint:` поверх stock-образа — всегда явно указывай `command:`, иначе recreate всё сломает. Симптомы: nginx → 502 везде; `docker logs olimp_backend` показывает только повторяющееся «Зависимости установлены» без gunicorn-запуска.

### 2026-05-13 — `sites/apps.txt` и `apps.json` не синхронизированы с фактически установленными app
Backend ругался на каждый `frappe.get_doc("Construction Project", ...)` (и любой другой наш DocType) с `DoesNotExistError: Модуль Olimp Construction не найден`, хотя: (а) Module Def «Olimp Construction» есть в БД, (б) `frappe.get_installed_apps()` возвращает `olimp_construction`. Причина: `frappe.local.module_app` (map `scrub(module_name) → app_name`) собирается на старте процесса **из `sites/apps.txt`** — а там было только `frappe\nerpnext`. У нас `configurator`-сервис при первом старте генерирует apps.txt как `ls -1 apps > sites/apps.txt`, но после ручных операций (`bench install-app`, ребут WSL с потерей volume content) файл может рассинхронизироваться. Аналогично `sites/apps.json` (метаданные версий) не содержал `olimp_construction`. Симптом: `bench console` видит модуль ОК, а HTTP-вызовы через gunicorn падают (потому что `frappe.local` инициализируется заново в каждом воркере). **Решение:** дописать `olimp_construction` в `sites/apps.txt` и добавить блок в `sites/apps.json`; рестартнуть backend. **Правило:** при ошибке «Модуль X не найден» при том что Module Def в БД существует — первым делом смотри `sites/apps.txt` и `apps.json`, потом `frappe.local.module_app`. Можно полечить через `bench --site SITE add-to-installed-apps olimp_construction`.

### 2026-05-14 — pyarrow/pandas нужно ставить в Frappe venv, не global pip
При импорте 55K расценок CWICR `import pyarrow` падает в HTTP-endpoint, хотя `pip install pyarrow` в backend контейнере прошёл успешно. Причина: Frappe gunicorn использует **свой venv** `/home/frappe/frappe-bench/env/lib/python3.11/site-packages/`, а `pip install` без явного пути ставит в `/usr/local/lib/python3.11/site-packages/`.
**Решение:** `docker exec olimp_backend /home/frappe/frappe-bench/env/bin/pip install pyarrow pandas`. После рестарта контейнера entrypoint должен поднимать через `requirements.txt` нашего app (там уже есть pyarrow>=15, pandas>=2). Если не подхватилось — повторить вручную в venv.

### 2026-05-14 — После compose stop/up Backend контейнеры scheduler/queue/queue_long падают с exit 127 (Recurrent baг)
Уже задокументировано в первой записи 2026-05-13 (backend без явного command:), но **проявляется снова при множественных перезапусках через одну сессию** (5+ раз `docker compose stop backend && docker compose up -d backend`). При каждом `up -d` зависимые контейнеры (depends_on) тоже передёргиваются и теряют CMD.
**Решение прямо сейчас:** `docker start olimp_scheduler olimp_queue_short olimp_queue_long` — поднимет существующие контейнеры с прежним CMD (без `compose recreate` который пересоздаст).
**Долгосрочное решение:** добавить явный `command:` для каждого из 3 сервисов в docker-compose.yml (по аналогии с backend). Backlog.

### 2026-05-14 — Создание стандартного DocType через JSON может не сработать без developer_mode + apps.txt
При создании `Catalog Work Item` через стандартный `bench migrate` таблица не создалась. Причины:
1. `developer_mode = 0` в site_config.json — Frappe не подхватывает .json из app без него (нужно `bench set-config developer_mode 1`)
2. `sites/apps.txt` рассинхронизирован — содержит только `frappe\nerpnext`, а должен `frappe\nerpnext\nolimp_construction`. Без этого `frappe.local.module_app['olimp_construction'] = None` и `frappe.get_module_app("Olimp Construction")` падает с `DoesNotExistError: Module Olimp Construction not found`.
**Решение, которое сработало:** создать DocType через `frappe.get_doc({"doctype":"DocType", "custom": 1, ...}).insert()` в console — `custom=1` обходит проверку standard, таблица создаётся. Минус: при deploy на чистую машину `bench migrate` не подхватит — нужно повторить.
**Профилактика:** перед созданием новых DocType: (1) `bench set-config developer_mode 1`, (2) проверить `sites/apps.txt`, (3) `clear-cache + полный compose stop/start`.

### 2026-05-14 — Frappe Field-types validation: после миграции колонки могут не появиться, нужен reload-doctype
После добавления полей в `deal.json` (lead_score / lead_grade / lead_score_breakdown) и `bench migrate` колонки **не появились в `tabDeal`**. `score_all_deals` упал с `OperationalError: Unknown column 'lead_score' in 'SET'`.
**Решение:** `bench --site erp.olimp-ural.ru reload-doctype Deal` — колонки появились сразу. То же для Change Order после добавления ball-in-court полей.
**Когда это срабатывает:** если backend упал во время migrate (например, был crash-loop) — `tabDocType` запись обновилась, а ALTER TABLE не выполнился. После `reload-doctype` идёт явный sync schema.
**Правило:** после `migrate` + crash-loop — проверить `SHOW COLUMNS FROM \`tabXxx\` LIKE 'new_field'`. Если пусто — `bench reload-doctype Xxx`.

### 2026-05-14 — `tabSeries` не инициализируется автоматически при autoname `XX-.YYYY.-.#####`
DocType с `autoname: "DL-.YYYY.-.#####"` (Deal) генерирует имена через `tabSeries.current`. Если в таблице нет записи `DL-2026-` (например, тестовые данные были загружены через direct SQL insert, минуя `frappe.model.naming`) — следующий `doc.insert()` начнёт счётчик с 1 → `DuplicateEntryError: DL-2026-00001`.
**Симптом:** Webhook/API создаёт документ, падает с `IntegrityError(1062, "Duplicate entry 'XX-YYYY-NNNNN' for key 'PRIMARY'")`.
**Решение:** SQL для синхронизации счётчика с фактическим max:
```sql
INSERT INTO tabSeries (name, current)
SELECT 'DL-2026-', COUNT(*) FROM `tabDeal` WHERE name LIKE 'DL-2026-%'
ON DUPLICATE KEY UPDATE current = GREATEST(current, VALUES(current));
```
Или через bench: `frappe.db.set_value("Series", "DL-2026-", "current", N)` если запись уже есть, либо `INSERT INTO tabSeries`.
**Правило:** при импорте/seed данных через direct SQL — **всегда** дополнительно обновлять `tabSeries`, иначе следующий API-creation упадёт. Для тестовых данных лучше использовать `frappe.get_doc({...}).insert()`, который сам обновит счётчик.

### 2026-05-14 — Прямой fuzzy-match названий разнотипных сущностей даёт мусор
Попытка автоматически привязать этапы Work Template (работы) к Catalog Resource (ресурсы CWICR) через `rapidfuzz` дала плохие результаты: «Транспортировка» → «Лебёдки», «Финишный декоративный слой» → ресурс 130К₽/м² → итоговая сумма огнезащиты 48 млн ₽ за 350 м² (нереалистично). Причина: CWICR содержит **ресурсы** (материалы/труд/оборудование), а этапы — это **работы**. Их номенклатуры не пересекаются один-к-одному.
**Правильное решение:** линковать раздельно — `materials_json` этапа → Material-ресурсы CWICR, `labor_hours_per_unit` → Labor-ресурсы. Это требует переработки модели Work Stage Template.
**Сейчас:** `api/ai/autolink_resources.py` оставлен как helper с предупреждением (min_score=88, строгие SEARCH_HINTS, SKIP_KEYWORDS для служебных этапов «контроль/приёмка/транспортировка»). Рекомендуется ручная привязка catalog_resource через админку.
**Правило:** прежде чем делать автоматический fuzzy-match — проверь что сравниваемые сущности **семантически одного типа** (работы↔работы, материалы↔материалы), не «всё со всем». Иначе получишь скрытые мусорные связи которые видно только когда смета даст фантастическую сумму.

### 2026-05-14 — После ребута WSL `__pycache__` оставляет «привидение» старой структуры → `Module Olimp Construction not found`
**Симптомы:** часть HTTP-endpoint'ов работает (read-only через `frappe.db.sql`), часть падает с `DoesNotExistError: Модуль Olimp Construction не найден` (везде, где есть `frappe.get_doc("Schedule Task"/"Project Risk"/...)`). При этом `bench --site ... execute frappe.get_installed_apps` показывает `olimp_construction` установлен, `sites/apps.txt` содержит его, `Module Def` в БД ОК. Прямой вызов `frappe.get_doc(...)` в console тоже падает. Через 12-15 минут починки выясняется: `frappe.local.module_app['olimp_construction'] = None` (должно быть `'olimp_construction'`).
**Причина:** `__pycache__` директории в `apps/olimp_construction/**/` содержат старые `.pyc` от прежней структуры приложения. При build `module_app` Frappe импортирует через них и не видит модули модулей.
**Решение:** `docker exec olimp_backend find /home/frappe/frappe-bench/apps/olimp_construction -name "__pycache__" -exec rm -rf {} +` + `docker compose stop backend && docker compose up -d backend` (полный stop/start, не restart). После этого `module_app` пересобирается корректно.
**Правило:** при любой ошибке «Модуль X не найден» при том, что `apps.txt`/`apps.json`/`get_installed_apps` показывают app установленным — **первым делом** прибить `__pycache__` в директории app и сделать полный stop/start backend контейнера. `bench clear-cache` и `docker restart` НЕ помогают (они не трогают `.pyc`-кеш Python).

### 2026-05-14 — `apply_to_estimate(risk)` при повторном вызове создавал дубль-резерв
В `api/risks.py::apply_to_estimate` первая версия делала `est.append("items", {item_code: f"RISK-{r.name}", ...})` без проверки на существующую строку и **без** `base_unit_price` (только `our_unit_price`). Результат: (а) каждый повторный клик «Применить в смету» добавлял новую строку с тем же `item_code` — задвоение резерва; (б) `base_total` сметы оставался нулевым → `margin_pct` искажался. Исправлено: ищем `existing = next(it for it in est.items if it.item_code == risk_item_code)`, при наличии — обновляем `qty/our_unit_price/base_unit_price/item_name`, при отсутствии — создаём с обоими полями цены. Возвращаем `action: "added" | "updated"` чтобы UI видел поведение.
**Правило:** для любых auto-applied строк (резервы, налоги, скидки) в child-табле — **всегда** проверять существование по `item_code`/`tag` перед `append`, и **всегда** заполнять и `base_unit_price`, и `our_unit_price` (Estimate считает маржу через разницу).

### 2026-05-14 — `frappe.has_permission("X", "create", throw=True)` в начале save-метода ломает апдейт для write-only ролей
В `api/risks.py::save_risk` и `api/schedule.py::save_task` первая версия проверяла `has_permission("...", "create", throw=True)` **в самом начале**, до проверки `if name and frappe.db.exists(...)`. Это значит, что роль с `write=1, create=0` (например, «Тендерный менеджер» с правом редактировать существующие риски, но не создавать новые) не могла апдейтить — throw срабатывал раньше развилки. **Правило:** в save-методах, поддерживающих create+update в одном endpoint, проверка permission должна быть **после** определения операции:
```python
if name and frappe.db.exists(DT, name):
    frappe.has_permission(DT, "write", doc=name, throw=True)  # update
    ...
else:
    frappe.has_permission(DT, "create", throw=True)  # create
    ...
```

### 2026-05-13 — `frappe.get_all("Material Request", order_by="modified desc")` падает с `Column 'modified' in ORDER BY is ambiguous`
В `api/project.get_detail` падала вся карточка проекта (открытие `/projects/PR-2026-0001`). Frappe для `Material Request` (у которого есть child-table `items` = Material Request Item) автоматически делает `LEFT JOIN` в запросе при определённых fields/filters, и колонка `modified` появляется в обеих таблицах. Простой `order_by="modified desc"` становится неоднозначным. **Решение:** указывать таблицу явно через backticks: `` order_by="`tabMaterial Request`.modified desc" `` (см. [api/project.py:93](backend/olimp_construction/olimp_construction/api/project.py#L93)). **Правило:** при `order_by` для DocType с дочерними таблицами всегда префиксуй имя таблицы. Также применимо к любому полю, имя которого совпадает в parent и child (`creation`, `owner`, `name`).

### 2026-05-17 — Для custom-DocType `before_save` из `.py` не вызывается надёжно — считай в API
DocType `Material Consumption`, созданный через console-workaround с `custom=1` (см. запись от 2026-05-14 «Создание стандартного DocType через JSON...»), имеет неинициализированный controller-class. `class MaterialConsumption(Document): def before_save(self): self.amount = self.qty * self.unit_price` — **не срабатывает**: после `doc.insert()` поле `amount = 0` несмотря на корректные qty/unit_price. Frappe не запускает `.py` hook для custom DocTypes, так как они формально не имеют связи с app-module (Module Def указывает на app, но class loader смотрит на стандартные DocTypes из app installation). **Решение:** считать calculated-поля (amount, итоги) **в API-функции перед save**, а не в `before_save` модели. Например, в `save_consumption`: `doc.amount = float(doc.qty or 0) * float(doc.unit_price or 0); doc.save()`. **Правило:** для DocTypes созданных через console-workaround (см. список в р.18 — Catalog Work Item, Foreman Check-in, Inspection Template, Inspection Run, User View, Construction Project Update, Site Cash Entry, Material Consumption) — не полагаться на `.py` hooks; делать всю логику в API. Долгосрочное решение — `bench migrate` со включенным `developer_mode + apps.txt`, но это требует пересоздания DocType.

### 2026-05-17 — ERPNext имеет встроенный `Project Update` DocType — кастомные имена должны префиксоваться
Попытка создать собственный DocType `Project Update` для еженедельных апдейтов проектов столкнулась с молчаливым конфликтом: `frappe.db.exists("DocType", "Project Update")` вернул True, но это был **встроенный ERPNext** `Project Update` (модуль Projects) с полями `naming_series/date/time/sent/amended_from` — совершенно другой. Если бы я не проверил структуру колонок через `SHOW COLUMNS`, мой API писал бы в чужую таблицу, ломая ERPNext-функционал. **Решение:** переименовать в `Construction Project Update` (с префиксом домена) — autoname `CPU-{YYYY}-{#####}`. **Правило:** для любого нового DocType со «слишком общим» именем (`Project Update`, `Task`, `Issue`, `Project`, `Customer`, `Item`, `Employee`, `Address`, `Note`) **всегда** проверять `frappe.db.exists("DocType", X)` И структуру `SHOW COLUMNS FROM tabX` перед созданием. Если таблица существует и имеет другие поля — добавлять префикс домена (`Construction Project Update`, `Olimp Task` и т.п.). См. также запись от 2026-05-12 (ERPNext `Project` коллизия) — это уже второй случай.

---

## 19. Что менялось от версии к версии

| Версия CLAUDE.md | Дата | Главное изменение |
|------------------|------|-------------------|
| v1.0 | первая версия | Базовые правила, ERPNext + Next.js |
| v2.0 | после ТЗ v2 | + AI-ассистент, + техника, + голос, + recommendation engine |
| **v2.1** | **2026-05-12** | **+ раздел 18 «Известные подводные камни» — фиксируем все баги, чтобы не повторялись** |
| **v2.2** | **2026-05-12** | **+ 3 записи в р.18: TenderLaw рассинхрон, дубль STATUSES_ACTIVE, Получено/Получена** |
| **v2.3** | **2026-05-12** | **Фаза 12.2: печать КС-2/КС-3 в гос.форме (ОКУД 0322005/0322001) — Jinja2 Print Format + openpyxl Excel; см. `api/exports.py` и `setup_print_formats()`** |
| **v2.4** | **2026-05-13** | **+ запись в р.18: парсер Гранд-Сметы XML (формат v12.x + windows-1251) — `import_from_gs_xml` теперь учитывает SMR-индекс и понижающий коэффициент из `<AddZatrats>`** |
| **v2.5** | **2026-05-13** | **+ 4 записи в р.18 (cron + хуки + статусы + Telegram). Реализованы 3 cron-задачи (equipment alerts, safety, project margin) + событийный пересчёт маржи через doc_events КС-2 и Material Request. Custom Fields на Construction Project применяются через `after_migrate` hook `olimp_construction.install.sync_custom_fields`** |
| **v2.6** | **2026-05-13** | **Идеи из OpenConstructionERP (AGPL-3.0, воспроизведены своими силами): (1) defusedxml в GS-парсере; (2) Change Orders — DocType `Change Order/Item` + страница `/change-orders` (workflow 5 статусов, раздельные суммы подрядчик/инженер/одобрено); (3) Cost Catalog ГЭСН — `Cost Catalog Item` + 21 seed-позиция + fuzzy через **rapidfuzz** + страница `/catalog`; (4) EVM Forecast — `api/evm.py` (CPI/SPI/EAC/ETC/VAC/TCPI) + `<EVMBlock>` в карточке проекта. + 2 записи в р.18: child DocType `before_save` ненадёжен; DocType требует и `.json`, и `.py`.** |
| **v2.7** | **2026-05-13** | **Идеи из OpenProject (GPL, изучены через субагента, воспроизведены своими силами): (1) Activity Feed — `api/activity.py` агрегирует события из 13 DocType, компонент `<ActivityFeed>` переиспользуется на дашборде и странице `/activity` с фильтрами; (2) Meetings — `Meeting` + `Meeting Item` + `Meeting Attendee`, страница `/meetings` с 2 табами (планёрки + агрегированные открытые поручения), сортировка просроченных первыми, inline смена статуса каждого поручения через `set_item_status`.** |
| **v2.8** | **2026-05-13** | **DDC CWICR импорт (CC BY 4.0): DocType `Catalog Resource` + 6 670 ресурсов (3875 материалов, 1631 оборудование, 1096 abstract, 68 труд) из С.-Пб + страница `/resources`. После аудита внедрены 4 доработки: (1) `api/search.py search_all` глобальный поиск по 15 DocType + `<GlobalSearch>` ⌘K модалка с навигацией ↑↓Enter; (2) `api/documents.py` документы проекта через File + Custom Fields `olimp_category/olimp_comment` + новая вкладка `<ProjectDocuments>` с upload/preview/удалить и 10 категорий; (3) `Employee Certification` DocType + `api/certification.py` + daily cron `check_certification_expiry` (Telegram-сводка за 30/14/7 дней, защита от спама через next_reminder_sent) + страница `/certifications` со светофором сроков; (4) `api/exports.py estimate_pdf/estimate_excel` + кнопки в `EstimateDrawer`. Версия v1.7.** |
| **v2.9** | **2026-05-13** | **Складской учёт (Фаза 3 закрыта): DocType `Stock Item` + `Stock Movement` (4 типа: Приход/Расход/Перемещение/Инвентаризация) с weighted-average pricing в `on_update`. Страница `/stock` с low-stock алертами и live-предпросмотром «остаток после операции» в drawer. Универсальный Excel-экспорт списков `api/exports.export_list(spec)` для 6 типов (tenders/projects/estimates/stock/certifications/ks2) + `<ExportButton>` в шапках страниц. Mobile responsiveness через `globals.css` @media + `<meta viewport>`: сайдбар становится горизонтальным, drawer'ы на всю ширину, гриды KPI коллапсируются 4→2→1 столбец. Селекторы через `[style*=...]` — работают с inline-стилями без переделки. Версия v1.8.** |
| **v3.0** | **2026-05-13** | **Print Format КС-6 (РД-11-05-2007, Ростехнадзор): новый Jinja-шаблон `print_format/kc_6_official/kc_6_official.html` (титульный лист + раздел 3 «Сведения о выполнении работ» 9 граф). `api/exports.py`: `worklog_pdf` через wkhtmltopdf landscape + `worklog_excel` через openpyxl. `_render_html` дополнен передачей `project_address` (из `Construction Project.location`), `_pdf_response` теперь принимает `orientation`. `_LIST_SPECS["worklog"]` — Excel-выгрузка списка журналов с целочисленным форматом `int_fields`. Next.js `/api/work-log/export?name=X&format=pdf\|xlsx`, кнопки PDF/Excel в шапке drawer, `<ExportButton spec="worklog">` на странице. Версия v2.0.** |
| **v3.1** | **2026-05-13** | **DDC-импульс (4 модуля из datadrivenconstruction): (1) `Catalog Resource` +5 нормативных полей CWICR (`labor_hours_per_unit`, `workers_count_per_unit`, `machine_hours_per_unit`, `electricity_kwh_per_unit`, `machine_class_name`); (2) DocType `EVM Snapshot` + daily cron `save_daily_evm_snapshots` + `api/evm.get_trend` + `<EVMTrendChart>` (SVG 600×90 с линиями CPI/SPI, пунктир 1.0, ΔCPI/ΔSPI) на странице проекта; (3) `tasks.send_daily_director_digest` — Telegram-сводка 09:00 с 5 разделами (горящие тендеры / красные EVM / просроченные поручения / истекающие аттестации / застрявшие MR), cron `0 9 * * *`; (4) Punch List — DocType `Punch List Item` (5 типов × 4 уровня срочности × 5 статусов, фото до/после), `api/punchlist.py` (6 методов), daily cron `check_punch_list_overdue` (раз в неделю на пункт), страница `/punch-list` с 5 KPI-фильтрами. + новый подводный камень: `frappe.get_all(order_by=...)` не принимает `CASE WHEN/FIELD()`. Версия v2.1.** |
| **v3.2** | **2026-05-13** | **Infra-fix трёх подводных камней (после ребута WSL весь стек встал): (1) `docker-compose.yml` сервис `backend` теперь имеет явный `command:` с полной строкой gunicorn — раньше при `docker compose up -d` контейнер пересоздавался без CMD → крэш-loop → 502; (2) `sites/apps.txt` и `apps.json` дополнены `olimp_construction` — без этого `frappe.get_doc()` падал с «Модуль Olimp Construction не найден» на всех страницах деталей (карточки проектов, смет, тендеров); (3) `api/project.get_detail` — для `Material Request` указан явный префикс таблицы в `order_by` (`` `tabMaterial Request`.modified ``), иначе SQL падал с `Column 'modified' is ambiguous` из-за неявного JOIN с child-table. Smoke-test: 24/24 API + 20/20 фронт-страниц зелёные.** |
| **v5.4** | **2026-05-17** | **Materials Usage прорабом (BuilderTrend Daily Log): DocType `Material Consumption` (autoname `MC-{YYYY}-{####}`) — прораб фиксирует расход материалов на объекте → подтверждение бухгалтером → списание со склада. Workflow Черновик → Подтверждён → Списан со склада (создаёт Stock Movement type=«Расход»). Поддерживает 2 способа: (а) Stock Item — авто-подтягивает item_name/unit/avg_price + warning о недостатке остатка; (б) текстовое название (для материалов вне склада). `api/material_consumption.py` 7 endpoints: list/save/confirm/writeoff/reject/delete/get_summary. Страница `/material-consumption` с фильтрами + 4 KPI (списано/подтверждено/черновики/всего) + таблицей с inline-действиями. + новая запись р.18: для custom-DocType (созданных через console с `custom=1`) `before_save` hook из `.py` не вызывается надёжно — расчёты amount-полей надо делать в API напрямую. Smoke 5/5 endpoints зелёные, TS 0 ошибок, HTTP 200 на `/material-consumption`.** |
| **v5.3** | **2026-05-17** | **Linear "Similar Issues" + Photo Before/After compare + Акт сверки 1С-формат. (1) **AI-детектор дубликатов** (Linear-style) — `api/duplicates.find_similar(doctype, text, project, threshold, limit)` использует `rapidfuzz` (без OpenAI/Qdrant): двойной score `0.7×token_sort_ratio(title) + 0.3×partial_ratio(full)`. Поддерживает Project Risk, Punch List Item, Schedule Task, Construction Project Update. Frontend `<SimilarItemsWarning>` с debounce 500ms, dismiss-кнопкой, цветными бейджами score (90%→красный, 80%→оранжевый). Подключён в `RiskDrawer` (при isNew) и в Punch List CreateDrawer. (2) **Photo Before/After Compare** — `<BeforeAfterCompare>` с двумя режимами: Split (side-by-side, как было) и Slider (overlay drag-handle как в BuilderTrend). Lightbox-просмотр по клику с ESC/← →. Внедрён в Punch List DetailDrawer (фото «До»/«После» теперь сравниваются интерактивно). (3) **Акт сверки** (1С/СБИС-формат) — `api/reconciliation.py`: `list_partners` (контрагенты с активностью), `build_reconciliation` (сальдо начальное + дебет КС-2 + кредит payment_received + Change Order одобренные + сальдо конечное), `export_xlsx` через openpyxl с заголовком/футером/подписями. Страница `/reconciliation` — выбор контрагента + период + 4 KPI + вывод «задолженность перед нами/наша задолженность» + таблица операций + кнопка «Скачать .xlsx». Поддерживает Customer (Supplier в след. итерации). Smoke 3/3 фич зелёные, TS 0 ошибок, HTTP 200 на `/reconciliation`, Excel-файл 5.8KB генерируется корректно.** |
| **v5.2** | **2026-05-17** | **Подсос Linear/Housecall Pro/1С:УНФ (3 параллельных subagent → 30 идей → внедрено 4): (1) **Project Health Updates** — DocType `Construction Project Update` (autoname `CPU-{YYYY}-{####}`) с светофором 🟢/🟡/🔴, AI-черновик из активности недели (подписанные КС-2, закрытые Schedule Task, новые риски, CPI/SPI снимок), страница `/project-updates` с табами «Портфель» (heatmap проектов, история 8 нед точками) и «Лента апдейтов», endpoints `get_portfolio_health/save_update/get_updates/get_draft_for/delete_update`. (2) **Site Cash Entry — касса на объекте** — DocType `Site Cash Entry` (autoname `SCE-{YYYY}-{####}`, 8 видов операций: ГСМ/Закупка/Бригада/Аренда/Питание/Возврат/Внесение/Прочее), статусы Черновик/Ждёт подтв./Подтверждён/Отклонён, страница `/site-cash` с фильтрами + балансами по проектам + одобрением, endpoints `save_entry/confirm_entry/reject_entry/get_summary/get_project_balance/list_entries/delete_entry`. (3) **Auto-rollover** незакрытых работ — `tasks.rollover_unfinished_work` weekly cron: просроченные Schedule Task и Punch List Item автоматически переезжают на +7 дней с пометкой «⏩ Auto-rollover» (комментарий + solution_notes), Telegram-сводка директору с разбивкой по проектам и срочности. (4) **«Я выехал» / «Я на объекте»** — `notify_arrival(project, foreman_name, eta_minutes)` API + 2 кнопки на `/checkin`: one-tap уведомление заказчику (если у Customer есть `telegram_chat_id`) или fallback в директорский чат с шаблоном «🚐 Бригада выехала · ETA 25 мин» / «📍 Бригада на объекте». + новая запись в р.18: ERPNext имеет свой `Project Update` DocType — наш переименован в `Construction Project Update`. Smoke 4/4 фич зелёные, TS 0 ошибок, HTTP 200 на обеих новых страницах.** |
| **v4.7** | **2026-05-14** | **ЕГРЮЛ lookup без регистрации DaData: fallback на egrul.itsoft.ru (публичный API ФНС без регистрации). Парсер ФНС-структуры (СвЮЛ/СвНаимЮЛ/СвАдресЮЛ/СведДолжнФЛ/СвОКВЭД). Страница /clients/inn-lookup с быстрой формой + 3 готовых ИНН (Сбербанк/Газпром/РЖД). При наличии DADATA_API_KEY — пробует DaData первой (403/timeout → fallback). Поле `source` в ответе показывает откуда данные (dadata.ru / egrul.itsoft.ru). Smoke: Сбербанк 7707083893 → ОГРН 1027700132195, директор ГРЕФ ✓.** |
| **v4.6** | **2026-05-14** | **Lead Scoring + DaData ИНН + Activity Timeline + UX-серия. (1) Lead Scoring rule-based: 7 правил (amount/source/company/status/history/freshness/completeness) → Grade A/B/C/D, auto-update в before_save Deal. Виджет на /leads-stats. (2) DaData lookup_by_inn / lookup_and_apply_to_customer — обогащение Customer данными ЕГРЮЛ. (3) Activity Timeline get_timeline собирает tabVersion + tabComment + tabCommunication, add_comment endpoint. (4) UX-серия: `<Skeleton>` + `<SkeletonTable>` + `<EmptyState>` + `<ToastProvider>` с useToast() в layout.tsx. (5) requirements.txt: + pyarrow>=15, pandas>=2.** |
| **v4.5** | **2026-05-14** | **HubSpot/Pipedrive/Procore подсос: 4 параллельных subagent на разведку (Procore, Linear/Notion, HubSpot/Pipedrive, PlanRadar/Fieldwire) → 28 идей → внедрено 5: (1) Pipeline Rotting — авто-rotting сделок (порог per stage: Лид=3д..В работе=30д), daily cron. (2) Win/Loss Reasons — обязательно при «Закрыт проигран», get_loss_analysis с win-rate по источникам. (3) Deal Forecasting — weighted=sum(amt×prob/100), commit≥80%, by_month. (4) Ball-in-Court для Change Order — current_responsible auto-handoff при смене статуса + days_with_current threshold. (5) Saved Views — DocType User View + CRUD API (UI в v4.8). Cron daily: refresh_rotting + refresh_ball_overdue.** |
| **v4.4** | **2026-05-14** | **Связь CWICR↔сметы/шаблоны + глобальный поиск. add_to_estimate(rate_code, estimate, qty, base_price) — расценка строкой в Estimate с notes из work_composition_text. convert_to_work_template(rate_code) — парсит work_composition_text regex'ом на этапы (split по точкам/спискам), создаёт Work Template-черновик (is_verified=0, source=«Импорт из ГЭСН»), source field в результате показывает «📋 ШАБЛОН» / «🤖 AI». Глобальный поиск (Ctrl+K) расширен: + Catalog Work Item (55K, 📕), + Work Template (47, 🪄).** |
| **v4.3** | **2026-05-14** | **CWICR FULL IMPORT — 55 719 уникальных расценок (это «полный CWICR 55K» о котором говорил исходный subagent). DocType `Catalog Work Item` (autoname=rate_code, custom=1 — создан через console т.к. apps.txt был рассинхрон, см. §18). Колонки: rate_code/rate_name/rate_unit/category_type/department_name/section_name/subsection_name/row_type/is_scope/is_abstract/work_composition_text/source/usage_count. api/ai/cwicr_import.import_work_items: pyarrow читает RU_SPB.parquet, groupby по rate_code, прямой INSERT IGNORE батчами 5K (через get_doc заняло бы час+) → 30 сек на 55K. api/ai/work_items_search.py с get_list/get_detail/get_facets. Frontend /catalog-work-items со списком + категории-чипы (СТРОИТЕЛЬНЫЕ 29K / МОНТАЖ ОБОРУДОВАНИЯ 19K / ...) + поиск + drawer с полным составом работ.** |
| **v4.2** | **2026-05-14** | **CWICR нормативная часть: импортировал 1631 machine_class_name из RU_SPB.parquet (раньше 0). pyarrow/pandas установлены в Frappe venv (/home/frappe/frappe-bench/env/bin/pip install), также в requirements.txt чтобы entrypoint восстанавливал при рестарте. api/ai/cwicr_import.py: import_from_parquet(parquet_path, region, update_prices, update_machine_class), get_import_status(). + новая запись в р.18: после рестарта backend pyarrow/pandas из global pip не видны — Frappe использует свой venv.** |
| **v4.1** | **2026-05-14** | **Apply Template + Leads Stats + Bulk Import Customers. (1) Кнопка 🪄 на /work-templates → ApplyTemplateModal → этапы добавляются в выбранную смету с qty×norm_per_base_unit, наценка % настраиваемая. (2) /leads-stats страница: расширенный get_lead_stats (KPI/funnel/by_source/timeline/recent) + bar-chart по дням (зелёные внутри = выигранные). (3) /clients/import: CSV-парсер (с поддержкой quoted fields), dry-run, превью первых 10 строк, валидация колонок, отчёт об ошибках. `bulk_import_customers` дедупит по customer_name. + scripts/import-examples/clients-template.csv готовый шаблон.** |
| **v4.0** | **2026-05-14** | **Telegram-бот для лидов + Stage Resource split + PDF Markup. (1) n8n/workflows/telegram-lead-bot.json — приём заявок через @OlimpZayavka_bot (отдельный от @Olimp_erp_bot для алертов), парсинг структурированных сообщений + создание Deal через webhook. (2) Stage Resource split — новый DocType `Work Stage Resource` (resource_type Material/Labor/Equipment, catalog_resource Link, qty_per_base_unit, fallback_price), добавлен child table resources в Work Stage Template; decompose_work считает sum(qty × CWICR.price_avg) по resources если есть, иначе legacy fallback. (3) PDF Markup MVP — DocType PDF Annotation (autoname PDF-{YYYY}-{#####}, signed_by/_at/_role), `<PDFAnnotator>` 420 строк (нативный embed src=pdf_file + overlay из absolute-divs с координатами в % контейнера), 4 инструмента (📝/▢/✓/✍️), /pdf-annotations со списком + CreateDialog. MVP-ограничения: page=1 всегда (нет multi-page без pdfjs), нет рукописного рисования (нет konva).** |
| **v3.9** | **2026-05-14** | **UI редактор Work Template — страница /work-templates. До этого 47 шаблонов редактировались только в админке Frappe. Backend: api/ai/work_templates.py — get_list/detail/save (полностью заменяет stages при update, иначе зомби-этапы)/delete/duplicate (is_verified=0 для копии)/get_categories. Frontend: страница с 4 KPI (всего/проверенных/черновиков/использовано раз), категории-чипы, debounced search, фильтры source+verified, таблица с цветными бейджами; `<WorkTemplateDrawer>` 390 строк с inline-таблицей этапов и кнопками ↑↓× для перемещения/удаления, валидацией snake_case template_id.** |
| **v3.8** | **2026-05-14** | **Webhook для приёма лидов с сайта/лендинга — без AI, готов сразу. `api/webhook/leads.py::create_lead` (allow_guest=True, methods=["POST"]): принимает name/phone/email/company/subject/description/source/utm_*, создаёт Customer (если такого company не было) с не-групповым territory + customer_group через `is_group=0` фильтр, создаёт Deal со status="Лид" и UTM-метками в description, шлёт Telegram-уведомление директору. Защита: honeypot-поле `website` (бот заполнит → возвращаем `{ok: true, skipped: "spam"}` тихо) + опциональный WEBHOOK_LEAD_SECRET в .env. `_normalize_phone` приводит к +79991234567, `_validate_email` через regex. `get_lead_stats(days)` — по source/total/won/lost. Next.js proxy `/api/webhook/lead` с CORS-OPTIONS. Готовая HTML-форма `scripts/webhook-examples/lead-form.html` с UTM из URL и AJAX-submit. + новая запись в р.18: `tabSeries` не инициализируется при seed через direct SQL → INSERT fix. Smoke 3 кейса: phone 8-формат норм. → +7, повторный company → reuse Customer, NextJS proxy JSON → Deal создаётся.** |
| **v3.7** | **2026-05-14** | **Расширения AI-декомпозиции (продолжение v3.6): (1) auto-link CWICR через rapidfuzz — `api/ai/autolink_resources.py` (экспериментально, прямой match названий этапов на CWICR-ресурсы даёт мусор → оставлено как helper, нужна ручная привязка); (2) расширение seed 20→47 шаблонов в `seed_work_templates_ext.py` (+27: земляные, фундаменты, кладка, гидроизоляция, утепление, перегородки, штукатурка, окраска, доп.полы, окна-двери, инженерные сети, скатные кровли, химанкеры, инъекция трещин); (3) дашборд `/decomposition-stats` — 8 KPI (всего, шаблон vs AI, CSAT), топ-10 шаблонов с good/bad, запросы без шаблона, активность пользователей, лента; (4) `track_diff(feedback_id, current_items)` — вычисляет added/removed/modified строк сметы относительно AI-генерации, сохраняет в Decomposition Feedback.user_diff_json; (5) `template_suggester.py` — `analyze_clusters` (rapidfuzz token_sort_ratio≥75%), `create_template_from_cluster` (черновик is_verified=0), cron weekly `suggest_templates`. + новая запись в р.18: автомат-fuzzy не подходит для линковки разнотипных сущностей (работы vs ресурсы). Smoke: 47 шаблонов в 11 категориях, all endpoints зелёные, TS 0 ошибок.** |
| **v3.6** | **2026-05-14** | **5 улучшений Work Template (продолжение v3.5): (1) расширение seed 5→20 шаблонов; (2) Qdrant semantic search — универсальные ensure_collection/upsert_points/search_collection в qdrant_client.py + коллекция `olimp_work_templates` + api/ai/work_templates_index.py (get_status/reindex/search); decompose_work сначала спрашивает Qdrant (если score≥0.45), fallback на keyword; без OPENAI_API_KEY работает на keyword; (3) Modular Chain-of-Thought (preprints.org Oct 2025) — 3 шага вместо одного (classify → extract → decompose), снижает галлюцинации 3-5×, функция `_ai_decompose_cot`; (4) stages → Catalog Resource (автоцена) — если этап привязан к catalog_resource, в декомпозицию приходит unit_price+amount, при applying base_unit_price=price_avg, our_unit_price=base×1.15; (5) Decomposition Feedback DocType — description, template_used, source, was_applied, was_edited_after, rating 👍/👌/👎, decomposition_json, user_diff_json; автосохранение в decompose_work; rate_feedback endpoint; экран оценки в UI после «Добавить в смету». TS 0 ошибок, smoke: 20 шаблонов, decompose работает, feedback сохраняется.** |
| **v3.5** | **2026-05-14** | **AI-декомпозиция работы → этапы сметы (главная фича): пользователь пишет «усиление плиты углеволокном 120 м²» → система раскладывает на 9 этапов (подготовка → грунт → раскрой → смола → укладка → пропитка → финиш → контроль) с qty/нормами/материалами/ГЭСН-шифрами. Архитектура hybrid: (а) DocType `Work Template` + `Work Stage Template` (child); (б) `api/ai/decompose_work.py::decompose_work(description, volume, estimate_name)` — извлекает объём regex'ом, keyword-matching по keywords+title, при match_score≥2 берёт шаблон и масштабирует, иначе Claude Haiku с системным промптом главного инженера; опционально добавляет этапы строками в Estimate; (в) `api/ai/seed_work_templates.py::seed_all` — 5 базовых шаблонов под профиль ОЛИМП (АКЗ РВС / огнезащита / CFRP / монтаж м/к / промальп); (г) Frontend `<DecomposeWorkModal>` 250 строк — input → превью этапов (№/этап/ед./qty/материалы/час·чел) с бейджем 📋ШАБЛОН / 🤖AI → кнопка ✓ Добавить в смету; (д) кнопка «🪄 AI-смета» в шапке EstimateDrawer. Smoke 3 кейса: АКЗ РВС-2000 1800м² → 1305 чел.-час ✓, огнезащита R90 350м² → 251 чел.-час ✓, видеонаблюдение → AI fallback → корректная ошибка о пустом балансе ✓.** |
| **v3.4** | **2026-05-14** | **Post-аудит fixes (3 параллельных subagent'а выкатили 80+ замечаний → закрыто 7 ключевых): (1) `risks.apply_to_estimate` теперь идемпотентен — повторный вызов обновляет существующую строку `RISK-{name}` вместо создания дубля + заполняет `base_unit_price` (раньше `margin_pct` искажался); (2) `save_risk`/`save_task` — проверка permission `write/create` ПОСЛЕ определения операции (раньше write-only роли не могли апдейтить); (3) `Schedule Task.validate` — throw если `end_date < start_date`; (4) `Schedule Task.before_save` — статус возвращается в «Запланирована» при `progress=0` (раньше залипал в «В работе»); (5) `Project Risk.validate` — throw на отрицательный `impact_amount`; (6) `_parse_level` (Python + TS `parseLvl`) — поддержка обычного дефиса `-` как и em-dash `—` (раньше `int(s.split("—")[0])` падал и score становился 0 → риск исчезал из матрицы); (7) `semantic_search.reindex_catalog` теперь требует роль `System Manager` (раньше любой залогиненный сметчик мог запустить платную операцию) + clamp `limit` в `[1..50]`; (8) RiskDrawer — добавлено поле `notes` (раньше нередактируемо через UI). + 3 записи в р.18: `__pycache__` поверх ребут WSL даёт false `Module not found`; `apply_to_estimate` дубль; permission order в save-методах. Smoke: 6/6 endpoints, TS 0 ошибок.** |
| **v3.3** | **2026-05-14** | **Три новых модуля одной сессией: (1) Графики работ (Gantt) — DocType `Schedule Task` (autoname `ST-{YYYY}-{#####}`, разделы через parent_task, critical path, авто-duration в before_save), `api/schedule.py` (get_tasks с агрегацией разделов, get_summary, save/delete/set_progress/set_dates), `<GanttChart>` 336 строк (timeline по дням, выходные, линия «сегодня», цвета по статусу/КП), `/schedule` список проектов и `/schedule/[project]` с диаграммой; (2) Реестр рисков — DocType `Project Risk` (autoname `RISK-{YYYY}-{#####}`, 9 категорий × 5 уровней probability × 5 уровней impact, авто `risk_score = P×I` и `contingency_amount = impact × probability/5`), `api/risks.py` 6 endpoints включая **get_matrix** (5×5 ячеек) и **apply_to_estimate** (добавляет резерв строкой в смету), `<RiskMatrix>` тепловая карта, `<RiskDrawer>`, `/risks` страница; (3) Семантический поиск каталога — модуль `ai_services/` (`qdrant_client.py` коллекция `olimp_catalog` 1536-dim Cosine + `embeddings.py` text-embedding-3-small batch до 1024), `api/semantic_search.py` (get_status / reindex_catalog / search), `<AISearchModal>` 231 строк подключён в `/resources` и `EstimateDrawer`, новые зависимости `qdrant-client>=1.7.0` + `openai>=1.50.0` в requirements.txt, `QDRANT_URL` в docker-compose. ⚠️ OPENAI_API_KEY всё ещё пуст — `reindex_catalog` ждёт ключа (после пополнения 1 POST = ~$0.002 на 6670 ресурсов). Smoke: 5/5 endpoints зелёные, TS 0 ошибок.** |

Когда обновляешь CLAUDE.md — добавляй запись в эту таблицу.
