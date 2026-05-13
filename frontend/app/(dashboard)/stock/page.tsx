"use client";

import { useCallback, useEffect, useState } from "react";
import type { StockItem, StockItemDetail, StockStats, MovementType } from "@/types/stock";
import { ExportButton } from "@/components/shared/ExportButton";

const CATEGORIES = ["ЛКМ (краски/лаки)", "Грунты", "Растворители", "Металлопрокат", "Крепёж", "Изоляция", "Кровельные", "Прочее"];
const MOVEMENT_TYPES: MovementType[] = ["Приход", "Расход", "Перемещение", "Инвентаризация"];

const MV_COLOR: Record<MovementType, string> = {
  "Приход":         "var(--success)",
  "Расход":         "var(--danger)",
  "Перемещение":    "var(--warning)",
  "Инвентаризация": "var(--accent)",
};

function fmt(n?: number | null, digits = 0) {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
function fmtM(n?: number | null) {
  if (!n) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} млн ₽`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)} тыс. ₽`;
  return `${n.toFixed(0)} ₽`;
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [stats, setStats] = useState<StockStats | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [showCreateMv, setShowCreateMv] = useState<{ open: boolean; preselectedItem?: string }>({ open: false });
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (debounced) p.set("search", debounced);
    if (categoryFilter) p.set("category", categoryFilter);
    if (lowStockOnly) p.set("low_stock_only", "1");
    p.set("limit", "500");
    const [data, st] = await Promise.all([
      fetch(`/api/stock?${p}`).then(r => r.json()),
      fetch(`/api/stock/stats`).then(r => r.json()),
    ]);
    setItems(Array.isArray(data) ? data : []);
    setStats(st && "total_items" in st ? st : null);
  }, [debounced, categoryFilter, lowStockOnly]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 32, maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Склад</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
            Остатки материалов с учётом приходов и расходов на проекты
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ExportButton spec="stock" />
          <button onClick={() => setShowCreateMv({ open: true })} style={{
            padding: "9px 16px", borderRadius: 10, border: "1px solid var(--accent)",
            background: "transparent", color: "var(--accent)",
            fontWeight: 500, fontSize: 13, cursor: "pointer",
          }}>+ Движение</button>
          <button onClick={() => setShowCreateItem(true)} style={{
            padding: "9px 16px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "white",
            fontWeight: 500, fontSize: 13, cursor: "pointer",
          }}>+ Материал</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <Kpi label="Позиций на складе" value={fmt(stats.total_items)} />
          <Kpi label="Стоимость остатка" value={fmtM(stats.total_value)} accent="var(--accent)" />
          <button onClick={() => setLowStockOnly(v => !v)} style={{
            background: lowStockOnly ? "rgba(239,68,68,0.15)" : "var(--bg-elevated)",
            border: `1px solid ${lowStockOnly ? "var(--danger)" : "var(--border-subtle)"}`,
            borderRadius: 12, padding: "14px 18px", textAlign: "left", cursor: "pointer", outline: "none",
          }}>
            <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontFamily: "monospace" }}>Ниже мин. остатка</p>
            <p style={{ fontSize: 22, fontWeight: 600, color: stats.low_stock > 0 ? "var(--danger)" : "var(--text-primary)", margin: "6px 0 0", fontFamily: "monospace" }}>{fmt(stats.low_stock)}</p>
          </button>
        </div>
      )}

      {/* Short items alert */}
      {stats?.short_items && stats.short_items.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "12px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px", fontFamily: "monospace" }}>⚠️ Нужно заказать</p>
          {stats.short_items.map(s => (
            <div key={s.name} style={{ fontSize: 13, padding: "3px 0", display: "flex", justifyContent: "space-between" }}>
              <span><b>{s.item_name}</b></span>
              <span style={{ color: "var(--danger)", fontFamily: "monospace" }}>
                {s.current_qty} / {s.min_qty} {s.unit} (дефицит {s.deficit})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filter row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <input
          type="search"
          placeholder="🔍 Поиск по наименованию или коду..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{
          padding: "10px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)", fontSize: 13, outline: "none", minWidth: 200,
        }}>
          <option value="">Все категории</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-base)" }}>
            <tr>
              <th style={th}>Материал</th>
              <th style={th}>Категория</th>
              <th style={th}>Ед.</th>
              <th style={th}>Остаток</th>
              <th style={th}>Мин.</th>
              <th style={th}>Ср. цена</th>
              <th style={th}>Стоимость</th>
              <th style={th}>Посл. движение</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                Материалов на складе нет. Создайте первую позицию.
              </td></tr>
            )}
            {items.map(it => (
              <tr key={it.name} onClick={() => setSelectedItem(it.name)} style={{
                borderTop: "1px solid var(--border-subtle)", cursor: "pointer",
                background: it.is_low ? "rgba(239,68,68,0.05)" : "transparent",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = it.is_low ? "rgba(239,68,68,0.05)" : "transparent")}>
                <td style={td}>
                  <div style={{ fontWeight: 500 }}>{it.item_name}</div>
                  {it.item_code && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>{it.item_code}</div>}
                </td>
                <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{it.category || "—"}</td>
                <td style={{ ...td, textAlign: "center", color: "var(--text-secondary)" }}>{it.unit}</td>
                <td style={{ ...td, fontFamily: "monospace", textAlign: "right", fontWeight: 600, color: it.is_low ? "var(--danger)" : "var(--text-primary)" }}>
                  {fmt(it.current_qty, 3)}
                </td>
                <td style={{ ...td, fontFamily: "monospace", textAlign: "right", color: "var(--text-tertiary)", fontSize: 11 }}>
                  {it.min_qty ? fmt(it.min_qty, 0) : "—"}
                </td>
                <td style={{ ...td, fontFamily: "monospace", textAlign: "right" }}>{it.avg_price ? fmt(it.avg_price, 2) : "—"}</td>
                <td style={{ ...td, fontFamily: "monospace", textAlign: "right", fontWeight: 500 }}>{fmt(it.total_value, 0)}</td>
                <td style={{ ...td, fontSize: 11, color: "var(--text-tertiary)", textAlign: "center" }}>{fmtDate(it.last_movement_date)}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <button onClick={(e) => { e.stopPropagation(); setShowCreateMv({ open: true, preselectedItem: it.name }); }} style={{
                    padding: "3px 8px", fontSize: 11, borderRadius: 5,
                    background: "transparent", border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)", cursor: "pointer",
                  }}>+ движение</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateItem && <CreateItemDrawer onClose={() => setShowCreateItem(false)} onSaved={() => { setShowCreateItem(false); load(); }} />}
      {showCreateMv.open && <CreateMovementDrawer
        items={items}
        preselectedItem={showCreateMv.preselectedItem}
        onClose={() => setShowCreateMv({ open: false })}
        onSaved={() => { setShowCreateMv({ open: false }); load(); }}
      />}
      {selectedItem && <ItemDrawer name={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "14px 18px" }}>
      <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontFamily: "monospace" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, color: accent ?? "var(--text-primary)", margin: "6px 0 0", fontFamily: "monospace" }}>{value}</p>
    </div>
  );
}

// ── Create Item Drawer ──────────────────────────────────────────────────────

function CreateItemDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    item_name: "", item_code: "", category: "Грунты", unit: "кг",
    default_warehouse: "Основной склад", min_qty: 0, notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.item_name.trim() || !form.unit) return;
    setSaving(true);
    try {
      await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <>
      <div onClick={onClose} style={backdrop} />
      <aside style={{ ...drawer, width: 520 }}>
        <Header title="Новая карточка материала" onClose={onClose} />
        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          <Field label="Наименование *">
            <input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="Грунт ВЛ-02" style={input} />
          </Field>
          <Field label="Артикул / код">
            <input value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} placeholder="GR-VL02" style={input} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Категория">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={input}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Ед. измерения *">
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="кг" style={input} />
            </Field>
            <Field label="Склад по умолчанию">
              <input value={form.default_warehouse} onChange={(e) => setForm({ ...form, default_warehouse: e.target.value })} style={input} />
            </Field>
            <Field label="Мин. остаток (для алертов)">
              <input type="number" value={form.min_qty} onChange={(e) => setForm({ ...form, min_qty: Number(e.target.value) })} style={input} />
            </Field>
          </div>
          <Field label="Примечание">
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...input, fontFamily: "inherit", resize: "vertical" }} />
          </Field>
        </div>
        <Footer onClose={onClose} onSave={save} disabled={!form.item_name.trim() || !form.unit} saving={saving} saveLabel="Создать материал" />
      </aside>
    </>
  );
}

// ── Create Movement Drawer ──────────────────────────────────────────────────

function CreateMovementDrawer({ items, preselectedItem, onClose, onSaved }: {
  items: StockItem[]; preselectedItem?: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    movement_type: "Приход" as MovementType,
    movement_date: new Date().toISOString().split("T")[0],
    stock_item: preselectedItem ?? "",
    qty: 0,
    unit_price: 0,
    warehouse: "Основной склад",
    warehouse_to: "",
    project: "",
    supplier_name: "",
    invoice_number: "",
    responsible: "",
    notes: "",
  });
  const [projects, setProjects] = useState<{ name: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []));
  }, []);

  const selectedItem = items.find(i => i.name === form.stock_item);

  async function save() {
    if (!form.stock_item || !form.qty) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (form.movement_type !== "Перемещение") delete payload.warehouse_to;
      if (form.movement_type !== "Приход") {
        delete payload.unit_price; delete payload.supplier_name; delete payload.invoice_number;
      }
      await fetch("/api/stock/movement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <>
      <div onClick={onClose} style={backdrop} />
      <aside style={{ ...drawer, width: 540 }}>
        <Header title="Движение склада" onClose={onClose} />
        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Тип операции *">
              <select value={form.movement_type} onChange={(e) => setForm({ ...form, movement_type: e.target.value as MovementType })} style={input}>
                {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Дата *">
              <input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} style={input} />
            </Field>
          </div>
          <Field label="Материал *">
            <select value={form.stock_item} onChange={(e) => setForm({ ...form, stock_item: e.target.value })} style={input}>
              <option value="">— выбрать —</option>
              {items.map(i => <option key={i.name} value={i.name}>{i.item_name}{i.item_code ? ` (${i.item_code})` : ""} · остаток {i.current_qty} {i.unit}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label={`Количество * ${selectedItem ? `(${selectedItem.unit})` : ""}`}>
              <input type="number" step="0.001" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} style={input} />
            </Field>
            {form.movement_type === "Приход" && (
              <Field label="Цена за единицу, ₽">
                <input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} style={input} />
              </Field>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: form.movement_type === "Перемещение" ? "1fr 1fr" : "1fr", gap: 12 }}>
            <Field label="Склад">
              <input value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} style={input} />
            </Field>
            {form.movement_type === "Перемещение" && (
              <Field label="Склад назначения">
                <input value={form.warehouse_to} onChange={(e) => setForm({ ...form, warehouse_to: e.target.value })} style={input} />
              </Field>
            )}
          </div>
          {form.movement_type === "Расход" && (
            <Field label="Проект (на что списываем)">
              <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={input}>
                <option value="">— не привязан —</option>
                {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
              </select>
            </Field>
          )}
          {form.movement_type === "Приход" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Поставщик">
                <input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="ХимТорг" style={input} />
              </Field>
              <Field label="№ накладной">
                <input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} style={input} />
              </Field>
            </div>
          )}
          <Field label="Ответственный (ФИО)">
            <input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} placeholder="Иванов И.И." style={input} />
          </Field>
          <Field label="Примечание">
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...input, fontFamily: "inherit", resize: "vertical" }} />
          </Field>
          {selectedItem && form.qty > 0 && (
            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 12 }}>
              Текущий остаток: <b style={{ fontFamily: "monospace" }}>{selectedItem.current_qty} {selectedItem.unit}</b>
              {form.movement_type === "Приход" && <> → станет <b style={{ color: "var(--success)", fontFamily: "monospace" }}>{selectedItem.current_qty + form.qty} {selectedItem.unit}</b></>}
              {form.movement_type === "Расход" && <> → станет <b style={{ color: form.qty > selectedItem.current_qty ? "var(--danger)" : "var(--warning)", fontFamily: "monospace" }}>{selectedItem.current_qty - form.qty} {selectedItem.unit}</b></>}
              {form.movement_type === "Инвентаризация" && <> → установится в <b style={{ fontFamily: "monospace" }}>{form.qty} {selectedItem.unit}</b></>}
            </div>
          )}
        </div>
        <Footer onClose={onClose} onSave={save} disabled={!form.stock_item || !form.qty} saving={saving} saveLabel={`Создать ${form.movement_type.toLowerCase()}`} />
      </aside>
    </>
  );
}

// ── Item Detail Drawer ──────────────────────────────────────────────────────

function ItemDrawer({ name, onClose }: { name: string; onClose: () => void }) {
  const [data, setData] = useState<StockItemDetail | null>(null);

  useEffect(() => {
    fetch(`/api/stock/detail?name=${encodeURIComponent(name)}`).then(r => r.json()).then(setData);
  }, [name]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  if (!data) return <><div onClick={onClose} style={backdrop} /><aside style={{ ...drawer, width: 640 }}><div style={{ padding: 24, color: "var(--text-tertiary)" }}>Загрузка...</div></aside></>;

  return (
    <>
      <div onClick={onClose} style={backdrop} />
      <aside style={{ ...drawer, width: 640 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>{data.item_name}</h2>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "4px 0 0", fontFamily: "monospace" }}>
              {data.name}{data.item_code ? ` · ${data.item_code}` : ""} · {data.category || "—"}
            </p>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          {/* KPI block */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
            <Kpi label="Остаток" value={`${fmt(data.current_qty, 3)} ${data.unit}`} accent={data.is_low ? "var(--danger)" : "var(--accent)"} />
            <Kpi label="Ср. цена" value={data.avg_price ? `${fmt(data.avg_price, 2)} ₽` : "—"} />
            <Kpi label="Стоимость" value={fmtM(data.total_value)} />
            <Kpi label="Мин." value={data.min_qty ? `${fmt(data.min_qty, 0)} ${data.unit}` : "—"} />
          </div>

          {/* Movements history */}
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "20px 0 8px", fontFamily: "monospace" }}>
            История движений ({data.movements?.length ?? 0})
          </p>
          <div style={{ background: "var(--bg-base)", borderRadius: 8, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            {(data.movements ?? []).map((m, i) => (
              <div key={m.name} style={{
                padding: "10px 14px", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, alignItems: "center",
              }}>
                <span style={{
                  padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: `${MV_COLOR[m.movement_type]}20`, color: MV_COLOR[m.movement_type],
                  minWidth: 90, textAlign: "center",
                }}>{m.movement_type}</span>
                <div>
                  <div style={{ fontSize: 12.5 }}>
                    {fmt(m.qty, 3)} {data.unit}
                    {m.movement_type === "Приход" && m.unit_price ? ` × ${fmt(m.unit_price, 2)} ₽ = ${fmt(m.amount, 0)} ₽` : ""}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
                    {m.movement_date} · {m.warehouse || "—"}
                    {m.project ? ` · ${m.project}` : ""}
                    {m.supplier_name ? ` · ${m.supplier_name}` : ""}
                    {m.responsible ? ` · ${m.responsible}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "right" }}>остаток</div>
                <div style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 600, textAlign: "right", minWidth: 70 }}>
                  {fmt(m.balance_after, 3)}
                </div>
              </div>
            ))}
            {(!data.movements || data.movements.length === 0) && (
              <div style={{ padding: 24, color: "var(--text-tertiary)", textAlign: "center", fontSize: 13 }}>
                Движений ещё не было
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
    <h2 style={{ margin: 0, fontSize: 17 }}>{title}</h2>
    <button onClick={onClose} style={closeBtn}>✕</button>
  </div>;
}

function Footer({ onClose, onSave, disabled, saving, saveLabel }: { onClose: () => void; onSave: () => void; disabled: boolean; saving: boolean; saveLabel: string }) {
  return <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
    <button onClick={onClose} style={btnSecondary}>Отмена</button>
    <button onClick={onSave} disabled={disabled || saving} style={{ ...btnPrimary, opacity: (disabled || saving) ? 0.5 : 1 }}>
      {saving ? "Сохранение..." : saveLabel}
    </button>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4, fontFamily: "monospace" }}>{label}</label>
    {children}
  </div>;
}

const th: React.CSSProperties = { padding: "11px 12px", textAlign: "left", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", fontWeight: 500 };
const td: React.CSSProperties = { padding: "10px 12px" };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" };
const backdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40, backdropFilter: "blur(2px)" };
const drawer: React.CSSProperties = { position: "fixed", top: 0, right: 0, bottom: 0, background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)", zIndex: 50, display: "flex", flexDirection: "column", overflow: "hidden" };
const closeBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 };
const btnSecondary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontSize: 13, cursor: "pointer", fontWeight: 500, flex: 1 };
