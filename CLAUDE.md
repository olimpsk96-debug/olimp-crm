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

### 2026-05-13 — Гранд-Смета XML: windows-1251 на фронте + реальный формат GS v12
**Файл сметы из Гранд-Сметы — в кодировке windows-1251.** `file.text()` в браузере декодирует как UTF-8 → русские строки превращаются в мусор. Правило: для XML импорта из GS читать через `arrayBuffer()` + детект encoding из declaration + `new TextDecoder("windows-1251")` (см. `EstimateDrawer.tsx` `handleImportXml`).

**Реальный формат GrandSmeta v12.x не похож на «общий XML».** Названия — в атрибуте `Caption` (не `Name`/`Title`), единица — `Units` (не `Unit`), объём с формулами — берём из дочернего `<Quantity Result="..."/>` (атрибут `Quantity` может содержать `100/1000` или `=ОКР(700; 2)`), цена — из `<PriceBase PZ="..."/>` (это ПЗ в ценах **2001 года**), а **актуальная цена = PZ × SMR-index** из `<Indexes><IndexesPos><Index SMR="..."/></IndexesPos></Indexes>`. Также есть `<AddZatrats>` — там понижающий договорной коэффициент с `Options="…AsKf"` (применяется к our_unit_price) и НДС с `Options="…Inactive"` (игнорируется на уровне Estimate). `<Header/>` — пустой разделитель, пропускать. **Правило:** при импорте новых внешних форматов сначала смотреть реальный XML/JSON клиента, потом писать парсер — общие шаблоны "Name/Title/Amount" почти никогда не угадывают.

### 2026-05-12 — Material Request: статус «Получено» vs «Получена»
В `material_request.json` (options) и `api/supply.py` (VALID_STATUSES), `types/supply.ts`, `supply/page.tsx`, `SupplyDrawer.tsx` стоял мужской род «Получено», а в `api/project.py` (SQL-запрос и фильтр на стороне Python) использовался женский род «Получена». Заявка (Material Request) — женского рода, поэтому корректное значение — **«Получена»**. Из-за рассинхрона `api/project.py` молча выдавал supply_total=0 (статус с женским родом не существовал в БД). Приведено к «Получена» во всех 6 местах. **Внимание:** label `"Получено"` в `ks2_act.json` (поле `payment_received`) — это другой контекст («получено денег»), его не трогаем. **Правило:** грамматический род в Select-options должен соответствовать роду DocType; меняй централизованно через `*.json` + grep по проекту.

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

Когда обновляешь CLAUDE.md — добавляй запись в эту таблицу.
