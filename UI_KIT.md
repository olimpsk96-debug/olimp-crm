# UI_KIT.md — Дизайн-система Олимп ERP

**Назначение:** единый источник правды для дизайна и фронт-разработки. Открывается при создании любого нового экрана / компонента.

**Эстетика:** Apple-style — refined minimalism, тёмная тема по умолчанию, числа как главный персонаж, минимум декорации.

---

## 1. Палитра

### 1.1 CSS Variables (используем везде)

```css
:root {
  /* Базовые тёмные тона */
  --bg-base:        #0A0A0B;   /* фон страницы */
  --bg-elevated:    #131316;   /* шапки, sidebar */
  --bg-card:        #18181C;   /* карточки */
  --bg-card-hover:  #1E1E23;   /* hover */
  --bg-overlay:     rgba(10,10,11,0.7); /* модалки, dropdowns */

  /* Границы */
  --border-subtle:  rgba(255,255,255,0.06);
  --border-strong:  rgba(255,255,255,0.12);
  --border-focus:   rgba(249,115,22,0.4);

  /* Текст */
  --text-primary:   #F4F4F5;   /* заголовки, важное */
  --text-secondary: #A1A1AA;   /* основной текст */
  --text-tertiary:  #71717A;   /* подсказки, метки */

  /* Семантика */
  --accent:         #F97316;   /* фирменный — оранжевый */
  --accent-hover:   #FB923C;
  --accent-glow:    rgba(249,115,22,0.15);

  --success:        #34D399;   /* деньги пришли, КС-2 подписан */
  --warning:        #FBBF24;   /* внимание, дедлайн скоро */
  --danger:         #F87171;   /* просрочка, риск */
  --info:           #818CF8;   /* нейтральные события */

  /* Радиусы */
  --radius-sm:      6px;
  --radius-md:      8px;
  --radius-lg:      12px;
  --radius-xl:      16px;
  --radius-2xl:     20px;
  --radius-full:    9999px;

  /* Тени (предельно мягкие) */
  --shadow-sm:      0 1px 2px rgba(0,0,0,0.3);
  --shadow-md:      0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg:      0 20px 40px -20px rgba(0,0,0,0.8);
  --shadow-glow:    0 4px 14px -4px var(--accent-glow);

  /* Анимации */
  --ease-out:       cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast:  150ms;
  --duration-base:  300ms;
  --duration-slow:  600ms;
}
```

### 1.2 Когда какой цвет

| Цвет | Когда |
|------|-------|
| `--accent` (оранжевый) | Главные CTA, активный пункт меню, фирменные элементы. Использовать **редко** — его сила в редкости |
| `--success` (зелёный) | Положительные числа, успешные статусы, маржа выше плана |
| `--warning` (жёлтый) | Предупреждения, дедлайны 3-7 дней, маржа ниже плана |
| `--danger` (красный) | Просрочки, дедлайны < 3 дней, отрицательная маржа |
| `--info` (индиго) | Нейтральные события, новые тендеры, информационные пиллы |

**Антипаттерн:** не использовать оранжевый для всего. Если все элементы оранжевые — никто не оранжевый.

---

## 2. Типографика

### 2.1 Шрифты

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=Inter+Tight:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

```css
.display-font { font-family: 'Fraunces', Georgia, serif; }
.body         { font-family: 'Inter Tight', -apple-system, sans-serif; }
.mono         { font-family: 'JetBrains Mono', monospace; }

/* Стандартные настройки */
body {
  font-feature-settings: 'cv11', 'ss01', 'ss03';
  letter-spacing: -0.011em;
  -webkit-font-smoothing: antialiased;
}

/* Числа всегда tabular */
.num { font-feature-settings: 'tnum', 'ss01'; letter-spacing: -0.04em; }
```

### 2.2 Шкала размеров

| Класс | Размер | Использование |
|-------|--------|---------------|
| `text-display-xl` | 48-56px / Fraunces 300 | Только hero на главных экранах |
| `text-display-lg` | 36-42px / Fraunces 300-400 | Заголовки страниц ("Командный центр") |
| `text-display-md` | 24-28px / Fraunces 500 | Заголовки блоков ("Активные объекты") |
| `text-display-sm` | 18-20px / Fraunces 500 | Под-заголовки карточек |
| `text-body-lg`    | 15px / Inter Tight 400 | Параграфы под заголовками |
| `text-body-md`    | 13.5-14px / Inter Tight 400 | Основной текст |
| `text-body-sm`    | 12.5-13px / Inter Tight 400-500 | Метаданные, подписи |
| `text-label`      | 11px / Inter Tight 500 | Лейблы, статус-пилюли |
| `text-mono-md`    | 12-13px / JetBrains Mono 400 | Числа, ID, даты |
| `text-mono-sm`    | 10.5-11px / JetBrains Mono 500 | Маленькие метки, uppercase tracking |

### 2.3 Правила

- **Заголовки** — Fraunces, обычно weight 300-500. Тяжелее 600 — почти никогда.
- **Числа в дашбордах** — крупные, `font-light` (300), tabular nums. Visual weight через размер, не через жирность.
- **Метки uppercase** — `tracking-wider`, `text-tertiary`, JetBrains Mono. Никогда не Inter в uppercase.
- **Letter-spacing** — для display всегда `-0.04em` или `-0.03em`. Без этого Fraunces расползается.

---

## 3. Spacing и сетка

Базовая единица: **4px**. Все размеры — кратные 4.

| Class | Px | Использование |
|-------|-----|---------------|
| `space-1` | 4px | Минимум между связанными элементами |
| `space-2` | 8px | Внутри карточек между мелкими элементами |
| `space-3` | 12px | Между близкими блоками |
| `space-4` | 16px | Стандарт между карточками |
| `space-5` | 20px | Padding средних карточек |
| `space-6` | 24px | Padding больших карточек |
| `space-8` | 32px | Между крупными секциями |
| `space-10` | 40px | Page padding (`px-10`) |
| `space-16` | 64px | Heroes, заметные разрывы |

**Сетка дашборда:**

```
[─── 260px sidebar ───][──── content (max 1400px) ────]
                       │
                       │ ┌─ 32px top gap
                       │ │
                       │ ├─ Hero block
                       │ │
                       │ ├─ 24px gap
                       │ │
                       │ ├─ KPI row (4 cols, gap-4)
                       │ │
                       │ ├─ 24px gap
                       │ │
                       │ ├─ Main grid (2/3 + 1/3, gap-4)
                       │ │
                       │ ╰─ ...
```

---

## 4. Базовые компоненты

### 4.1 Card

```jsx
<div className="card">           // var(--bg-card)
<div className="card-elevated">  // gradient, shadow-lg

// CSS:
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);  // 16px
  transition: all var(--duration-base) var(--ease-out);
}
.card:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-strong);
}

.card-elevated {
  background: linear-gradient(180deg, #1A1A1F 0%, #15151A 100%);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.04) inset,  // верхний highlight
    var(--shadow-lg);
}
```

**Когда elevated, когда обычная:**
- `card-elevated` — главные блоки на дашборде (таблица проектов, cashflow)
- `card` — вторичные карточки, KPI плитки, элементы списка

### 4.2 Pill (статусные метки)

```jsx
<span className="pill pill-success">оплачен</span>
<span className="pill pill-warning">3 дня</span>
<span className="pill pill-danger">просрочен</span>

// CSS:
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.pill-success { background: rgba(52,211,153,0.1);  color: var(--success); }
.pill-warning { background: rgba(251,191,36,0.1);  color: var(--warning); }
.pill-danger  { background: rgba(248,113,113,0.1); color: var(--danger);  }
.pill-info    { background: rgba(99,102,241,0.1);  color: var(--info);    }
.pill-neutral { background: rgba(255,255,255,0.04); color: var(--text-secondary); }
```

### 4.3 Кнопки

```jsx
// Primary (используется на странице 1 раз)
<button className="btn btn-primary">Создать КС-2</button>

// Secondary (стандартные действия)
<button className="btn btn-secondary">Поделиться</button>

// Tertiary (низкий приоритет)
<button className="btn btn-tertiary">Отмена</button>

// CSS:
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  font-size: 13px; font-weight: 500;
  transition: all var(--duration-fast) ease;
}
.btn-primary {
  background: var(--accent);
  color: white;
  box-shadow: var(--shadow-glow);
}
.btn-primary:hover { background: var(--accent-hover); }

.btn-secondary {
  background: rgba(255,255,255,0.04);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}
.btn-secondary:hover { background: rgba(255,255,255,0.08); }

.btn-tertiary {
  background: transparent;
  color: var(--text-secondary);
}
.btn-tertiary:hover { color: var(--text-primary); }
```

### 4.4 Input + поиск

```jsx
<div className="input-wrapper">
  <SearchIcon />
  <input placeholder="Поиск..." />
  <kbd>⌘K</kbd>
</div>

// CSS:
.input-wrapper {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) ease;
}
.input-wrapper:focus-within {
  border-color: var(--border-focus);
  background: rgba(255,255,255,0.05);
}
.input-wrapper input {
  background: transparent; outline: none; border: none;
  color: var(--text-primary); font-size: 13px;
}
```

### 4.5 KPI карточка (формат)

```jsx
<div className="card lift p-5">
  <div className="flex items-center justify-between mb-3">
    <span className="text-mono-sm uppercase tracking-wider text-tertiary">
      Выручка YTD
    </span>
    <span className="pill pill-success">↗ 12,4%</span>
  </div>
  <div className="num text-[34px] font-light leading-none">
    52,8 <span className="text-[18px] text-secondary">млн ₽</span>
  </div>
  <div className="text-[11.5px] mt-2 text-tertiary">
    из ~120 млн ₽ цели
  </div>
  <div className="mt-3 progress-bar"><div className="progress-fill"></div></div>
</div>
```

**Правила KPI:**
- Лейбл — uppercase, tracking-wider, JetBrains Mono, тёмный (text-tertiary)
- Дельта — pill в правом верхнем углу
- Главное число — крупное (28-34px), `font-light` (300), tabular nums
- Единицы измерения — мельче (14-18px), `text-secondary`
- Под-подпись — text-tertiary, 11-12px
- Опциональный прогресс-бар или sparkline снизу

### 4.6 Прогресс-бары

```css
.progress-bar {
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-hover));
  border-radius: var(--radius-full);
  transform-origin: left;
  animation: fill 1.4s var(--ease-out) forwards;
  transform: scaleX(0);  /* стартовое */
}
@keyframes fill { to { transform: scaleX(var(--progress)); } }
```

Использование: `<div style="--progress: 0.84;">` — заполнение определяется CSS-переменной.

### 4.7 Sparkline (мини-графики)

```jsx
<svg width="100%" height="32" viewBox="0 0 200 32" preserveAspectRatio="none">
  <path
    className="spark-path"
    d="M0,24 L25,22 L50,18 ... L200,6"
    stroke="var(--success)"
    strokeWidth="1.5"
    fill="none"
    vectorEffect="non-scaling-stroke"
  />
</svg>
```

С анимацией рисования:
```css
.spark-path {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: draw 2s var(--ease-out) forwards;
}
@keyframes draw { to { stroke-dashoffset: 0; } }
```

---

## 5. Анимации

### 5.1 Принципы

1. **Анимации содержательные, не декоративные**
2. **Один well-orchestrated entrance > 10 микро-анимаций**
3. **Easing всегда** `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out более резкий, как в iOS)
4. **Длительность 150-700мс**. Меньше — невидно. Больше — раздражает.
5. **Hover — едва заметный** (`translateY(-2px)`, `transform 0.4s`)

### 5.2 Stagger entrance (главный паттерн)

```css
.stagger > * {
  opacity: 0;
  transform: translateY(8px);
  animation: rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.stagger > *:nth-child(1) { animation-delay: 0.05s; }
.stagger > *:nth-child(2) { animation-delay: 0.10s; }
.stagger > *:nth-child(3) { animation-delay: 0.15s; }
/* ... до 8-9 */

@keyframes rise {
  to { opacity: 1; transform: translateY(0); }
}
```

### 5.3 Lift (hover на карточках)

```css
.lift {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.lift:hover { transform: translateY(-2px); }
```

### 5.4 Pulse (живые индикаторы — "система работает")

```css
.dot {
  width: 6px; height: 6px;
  border-radius: 9999px;
  background: var(--success);
  position: relative;
}
.dot::before {
  content: ''; position: absolute; inset: 0;
  border-radius: inherit; background: inherit;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.8); opacity: 0; }
}
```

---

## 6. Иконки

### 6.1 Стиль

- Только outline (без filled)
- Толщина обводки: **1.6px** для 16px иконок, **1.8px** для 20+px
- Stroke linecap: round
- Размеры: 13 / 14 / 16 / 18 / 20px

### 6.2 Источники

- Custom SVG для главных навигационных (лучшее качество, контроль)
- `lucide-react` для второстепенных (огромная библиотека)
- **Не использовать** Heroicons, Material, FontAwesome (банально)

### 6.3 Пример custom

```jsx
// Иконка "Объекты" (стилизованный график)
<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
     stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
  <path d="M2 13l3-7 3 4 2-3 4 6"/>
  <circle cx="2" cy="13" r="0.5" fill="currentColor"/>
</svg>
```

---

## 7. Атмосферные детали

### 7.1 Background gradient (фон страницы)

```css
body::before {
  content: '';
  position: fixed; inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(249,115,22,0.08), transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99,102,241,0.04), transparent 50%);
  pointer-events: none;
  z-index: 0;
}
```

Едва заметные глубинные градиенты. Без них фон скучный.

### 7.2 Grain (текстура)

```css
.grain::after {
  content: '';
  position: absolute; inset: 0;
  background-image: url("data:image/svg+xml,...turbulence...");
  opacity: 0.025;
  mix-blend-mode: overlay;
  pointer-events: none;
}
```

Применяется глобально на body. Лечит "пластиковость" больших тёмных областей.

### 7.3 Glassmorphism (sticky headers)

```css
header {
  background: rgba(10,10,11,0.7);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
}
```

Только для **sticky/fixed** элементов. Не разбрасывать по интерфейсу.

---

## 8. Mobile (PWA)

### 8.1 Брейкпоинты

```css
/* Mobile-first */
default: < 640px        /* телефон */
sm: 640px              /* широкий телефон */
md: 768px              /* планшет */
lg: 1024px             /* десктоп малый */
xl: 1280px             /* десктоп */
2xl: 1440px            /* широкий */
```

### 8.2 Что меняется на mobile

- Sidebar → **bottom navigation bar** (5 главных пунктов)
- Page padding `px-10` → `px-4`
- Card grid 4 cols → 1-2 cols
- Карточки проектов: collapse, отдельная страница
- Графики adaptive width
- Touch targets минимум **44×44px**

### 8.3 PWA manifest (для установки на главный экран)

```json
{
  "name": "Олимп ERP",
  "short_name": "Олимп",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0A0B",
  "theme_color": "#F97316",
  "icons": [...]
}
```

---

## 9. Чеклист "хорошо ли это сделано"

Перед коммитом любого экрана:

- [ ] Используешь только цвета из палитры (нет произвольных hex)
- [ ] Все числа с `tnum` (через `.num` класс)
- [ ] Нет жирных заголовков weight ≥ 700 (Fraunces 300-600)
- [ ] Spacing кратен 4px
- [ ] Радиус карточек 12 или 16 (не 10, не 14)
- [ ] Hover-состояния на всём интерактивном
- [ ] Анимации с `cubic-bezier(0.16, 1, 0.3, 1)`
- [ ] Stagger entrance на длинных списках/гридах
- [ ] Mobile-версия не сломана
- [ ] Контраст текст/фон ≥ 4.5:1 (a11y)
- [ ] Все интерактивные элементы доступны с клавиатуры
- [ ] Состояния: loading, empty, error — продуманы

---

## 10. Что **никогда** не делать

❌ Generic Inter в uppercase для меток (это банально, используем JetBrains Mono)
❌ Purple gradients (cliché AI-design)
❌ Drop shadows с blur > 40px (выглядит как Win XP)
❌ Border radius < 6px на крупных карточках (выглядит резко)
❌ Анимации >700мс на UI-переходах (медленно)
❌ Эмодзи в продуктивном UI (несерьёзно для директора)
❌ Скругление кнопок > 16px (превращает в "пилюли", выглядит детски)
❌ Свечения / neon / cyberpunk (это не корпоративный стиль)
❌ 3+ цветных акцента одновременно (теряется иерархия)
❌ Текст на цветном фоне с малым контрастом
