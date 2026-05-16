"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface Assembly {
  name: string;
  assembly_code: string;
  assembly_name: string;
  category: string;
  unit: string;
  labor_hours: number;
  base_rate: number;
  market_rate: number;
  margin_percent: number;
  is_active: number;
  items_count: number;
  applicable_objects: string;
  description?: string;
}

interface AssemblyItem {
  name?: string;
  idx?: number;
  resource_type: string;
  description: string;
  catalog_resource?: string | null;
  qty_per_unit: number;
  unit: string;
  rate: number;
  amount: number;
  notes?: string;
}

interface Category { category: string; count: number; }

const RESOURCE_TYPES = ["material", "labor", "equipment", "subcontract"];
const CATEGORIES = [
  "АКЗ / Огнезащита", "Усиление углеволокном", "Монтаж металлоконструкций",
  "Кровельные работы", "Бетонные работы", "Промальп", "Сварка",
  "Демонтаж", "Земляные работы", "Прочее",
];

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

function resourceColor(type: string): string {
  return type === "material" ? "#16a34a"
       : type === "labor"    ? "#3b82f6"
       : type === "equipment" ? "#a855f7"
       : "#eab308";
}

export default function AssembliesPage() {
  const toast = useToast();
  const [items, setItems] = useState<Assembly[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [filter, setFilter] = useState({ category: "", search: "" });
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ name?: string; assembly?: Assembly } | null>(null);
  const [seeding, setSeeding] = useState(false);

  function reload() {
    setLoading(true);
    const p = new URLSearchParams({ active_only: "1", limit: "300" });
    if (filter.category) p.set("category", filter.category);
    if (filter.search) p.set("search", filter.search);
    Promise.all([
      fetch(`/api/assemblies?${p}`).then((r) => r.json()),
      fetch("/api/assemblies?mode=categories").then((r) => r.json()),
    ])
      .then(([list, c]) => {
        setItems(Array.isArray(list) ? list : []);
        setCats(Array.isArray(c) ? c : []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function runSeed() {
    if (!window.confirm("Установить 8 типовых сборок Олимпа?")) return;
    setSeeding(true);
    try {
      const r = await fetch("/api/assemblies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed", force: 0 }),
      });
      const d = await r.json();
      if (d.error) toast.error(d.error);
      else { toast.success(`Создано ${d.created}, пропущено ${d.skipped}`); reload(); }
    } finally { setSeeding(false); }
  }

  async function deleteItem(name: string) {
    if (!window.confirm(`Удалить сборку ${name}?`)) return;
    const r = await fetch(`/api/assemblies?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success("Удалено"); reload(); }
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Сборки работ (Construction Assembly)</h1>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
            Типовые рецепты «ресурсы на единицу работы» · можно применять в сметах
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {items.length === 0 && (
            <button onClick={runSeed} disabled={seeding} style={btnSecondary}>
              🌱 Установить 8 типовых
            </button>
          )}
          <button onClick={() => setEditor({})} style={{
            padding: "10px 18px", fontSize: 13, fontWeight: 500,
            background: "var(--accent)", color: "white",
            border: "none", borderRadius: 8, cursor: "pointer",
          }}>+ Новая сборка</button>
        </div>
      </div>

      {/* Categories chips */}
      {cats.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <button onClick={() => setFilter({ ...filter, category: "" })} style={chipStyle(!filter.category)}>
            Все ({items.length})
          </button>
          {cats.map((c) => (
            <button key={c.category} onClick={() => setFilter({ ...filter, category: c.category })}
                    style={chipStyle(filter.category === c.category)}>
              {c.category} ({c.count})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })}
               placeholder="Поиск по названию..."
               style={{
                 width: "100%", maxWidth: 400, padding: "9px 12px", fontSize: 13,
                 background: "var(--bg-elevated)", color: "var(--text-primary)",
                 border: "1px solid var(--border-subtle)", borderRadius: 7, outline: "none",
               }} />
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && items.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
          Сборок пока нет.<br/>
          <div style={{ marginTop: 12 }}>
            <button onClick={runSeed} disabled={seeding} style={{ ...btnSecondary, fontSize: 13 }}>
              🌱 Установить 8 типовых сборок Олимпа
            </button>
          </div>
        </div>
      )}

      {/* Grid of cards */}
      {!loading && items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
          {items.map((a) => (
            <div key={a.name} onClick={() => setEditor({ name: a.name, assembly: a })}
                 style={{
                   padding: 14, borderRadius: 10, cursor: "pointer",
                   background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                   transition: "border 0.15s",
                 }}
                 onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                 onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "monospace", letterSpacing: "0.04em" }}>
                  {a.assembly_code}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {a.items_count} ресурсов
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>
                {a.assembly_name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>
                {a.category}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 8, borderTop: "1px dashed var(--border-subtle)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                    база/{a.unit}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: "monospace" }}>
                    {fmtMoney(a.base_rate)}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                    рынок
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: "var(--accent)" }}>
                    {fmtMoney(a.market_rate)}
                  </div>
                </div>
                <div style={{ flex: 0 }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                    маржа
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace",
                                color: a.margin_percent >= 30 ? "var(--success)" : a.margin_percent >= 15 ? "#eab308" : "var(--danger)" }}>
                    {a.margin_percent.toFixed(0)}%
                  </div>
                </div>
              </div>
              {a.applicable_objects && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                  📌 {a.applicable_objects.substring(0, 60)}{a.applicable_objects.length > 60 ? "…" : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editor && (
        <AssemblyEditor name={editor.name} onClose={() => setEditor(null)}
                        onSaved={() => { setEditor(null); reload(); }}
                        onDelete={(n) => { setEditor(null); deleteItem(n); }} />
      )}
    </div>
  );
}

function AssemblyEditor({ name, onClose, onSaved, onDelete }: {
  name?: string;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (name: string) => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Assembly>>({
    assembly_code: "", assembly_name: "", category: "Прочее",
    unit: "м²", market_rate: 0, labor_hours: 0, is_active: 1,
  });
  const [items, setItems] = useState<AssemblyItem[]>([]);
  const [loading, setLoading] = useState(!!name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!name) return;
    fetch(`/api/assemblies?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        setF({
          assembly_code: d.assembly_code, assembly_name: d.assembly_name,
          category: d.category, unit: d.unit,
          labor_hours: d.labor_hours || 0,
          market_rate: d.market_rate || 0,
          description: d.description, applicable_objects: d.applicable_objects,
          is_active: d.is_active,
        });
        setItems(d.items || []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const base_rate = useMemo(() => items.reduce((s, i) => s + (i.qty_per_unit || 0) * (i.rate || 0), 0), [items]);
  const margin = useMemo(() => {
    const m = f.market_rate || 0;
    return base_rate > 0 ? ((m - base_rate) / base_rate) * 100 : 0;
  }, [base_rate, f.market_rate]);

  async function save() {
    if (!f.assembly_code?.trim()) { toast.warn("Код сборки обязателен"); return; }
    if (!f.assembly_name?.trim()) { toast.warn("Название обязательно"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/assemblies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", name, ...f, items }),
      });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(`${d.action === "created" ? "Создано" : "Обновлено"} · база ${d.base_rate?.toFixed(0)} ₽`);
      onSaved();
    } finally { setSaving(false); }
  }

  function addItem() {
    setItems([...items, { resource_type: "material", description: "", qty_per_unit: 0,
                           unit: "шт", rate: 0, amount: 0 }]);
  }
  function updateItem(idx: number, patch: Partial<AssemblyItem>) {
    setItems(items.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      next.amount = (next.qty_per_unit || 0) * (next.rate || 0);
      return next;
    }));
  }
  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 760, maxHeight: "90vh", overflowY: "auto",
        background: "var(--bg-base)", borderRadius: 12,
        border: "1px solid var(--border-subtle)", padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>
            {name ? "Редактирование сборки" : "Новая сборка"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 100px", gap: 10, marginBottom: 12 }}>
              <Field label="Код *">
                <input value={f.assembly_code || ""} onChange={(e) => setF({ ...f, assembly_code: e.target.value })}
                       disabled={!!name}
                       placeholder="AKZ-G3-M2" style={{ ...inpStyle, fontFamily: "monospace" }} />
              </Field>
              <Field label="Название *">
                <input value={f.assembly_name || ""} onChange={(e) => setF({ ...f, assembly_name: e.target.value })}
                       placeholder="АКЗ группа 3, 2 слоя — м²" style={inpStyle} />
              </Field>
              <Field label="Ед. изм. *">
                <input value={f.unit || ""} onChange={(e) => setF({ ...f, unit: e.target.value })}
                       placeholder="м²" style={inpStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              <Field label="Категория">
                <select value={f.category || "Прочее"} onChange={(e) => setF({ ...f, category: e.target.value })} style={inpStyle}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Чел-часов на ед.">
                <input type="number" min={0} step={0.01} value={f.labor_hours ?? 0}
                       onChange={(e) => setF({ ...f, labor_hours: parseFloat(e.target.value) || 0 })} style={inpStyle} />
              </Field>
              <Field label="Рыночная цена ₽">
                <input type="number" min={0} value={f.market_rate ?? 0}
                       onChange={(e) => setF({ ...f, market_rate: parseFloat(e.target.value) || 0 })}
                       style={{ ...inpStyle, fontFamily: "monospace", fontWeight: 500 }} />
              </Field>
            </div>

            {/* Calc preview */}
            <div style={{
              padding: 10, marginBottom: 12, borderRadius: 8,
              background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.3)",
              display: "flex", justifyContent: "space-around", fontSize: 13, fontFamily: "monospace",
            }}>
              <div>База: <b>{fmtMoney(base_rate)}</b></div>
              <div>Рынок: <b>{fmtMoney(f.market_rate || 0)}</b></div>
              <div>Маржа: <b style={{ color: margin >= 30 ? "var(--success)" : margin >= 15 ? "#eab308" : "var(--danger)" }}>
                {margin.toFixed(1)}%
              </b></div>
            </div>

            <Field label="Применяется на объектах">
              <input value={f.applicable_objects || ""} onChange={(e) => setF({ ...f, applicable_objects: e.target.value })}
                     placeholder="НТМК, СВЕЗА, резервуары РВС" style={inpStyle} />
            </Field>

            <div style={{ height: 14 }} />

            {/* Items table */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>Состав сборки ({items.length} ресурсов)</h3>
              <button onClick={addItem} style={{
                padding: "4px 10px", fontSize: 11, fontWeight: 500,
                background: "transparent", color: "var(--accent)",
                border: "1px dashed var(--accent)", borderRadius: 6, cursor: "pointer",
              }}>+ Ресурс</button>
            </div>
            <div style={{
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              borderRadius: 8, overflow: "hidden",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <th style={th}>Тип</th>
                    <th style={th}>Описание</th>
                    <th style={{ ...th, textAlign: "right", width: 70 }}>Кол-во</th>
                    <th style={{ ...th, width: 50 }}>Ед.</th>
                    <th style={{ ...th, textAlign: "right", width: 80 }}>Цена</th>
                    <th style={{ ...th, textAlign: "right", width: 90 }}>Сумма</th>
                    <th style={{ ...th, width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={td}>
                        <select value={it.resource_type} onChange={(e) => updateItem(i, { resource_type: e.target.value })}
                                style={{ ...inpCell, color: resourceColor(it.resource_type), fontWeight: 500 }}>
                          {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td style={td}>
                        <input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })}
                               style={inpCell} />
                      </td>
                      <td style={td}>
                        <input type="number" min={0} step={0.01} value={it.qty_per_unit}
                               onChange={(e) => updateItem(i, { qty_per_unit: parseFloat(e.target.value) || 0 })}
                               style={{ ...inpCell, textAlign: "right", fontFamily: "monospace" }} />
                      </td>
                      <td style={td}>
                        <input value={it.unit} onChange={(e) => updateItem(i, { unit: e.target.value })}
                               style={{ ...inpCell, textAlign: "center" }} />
                      </td>
                      <td style={td}>
                        <input type="number" min={0} value={it.rate}
                               onChange={(e) => updateItem(i, { rate: parseFloat(e.target.value) || 0 })}
                               style={{ ...inpCell, textAlign: "right", fontFamily: "monospace" }} />
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                        {fmtMoney(it.amount || 0)}
                      </td>
                      <td style={td}>
                        <button onClick={() => removeItem(i)} style={{
                          background: "transparent", border: "none", color: "var(--danger)",
                          cursor: "pointer", fontSize: 14, padding: "2px 4px",
                        }}>×</button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--text-tertiary)", padding: 20 }}>
                      Нет ресурсов. Нажмите «+ Ресурс»
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18 }}>
              {name && (
                <button onClick={() => onDelete(name)} style={{
                  padding: "10px 16px", fontSize: 13,
                  background: "transparent", color: "var(--danger)",
                  border: "1px solid var(--danger)", borderRadius: 8, cursor: "pointer",
                }}>🗑 Удалить</button>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={onClose} style={{
                  padding: "10px 18px", fontSize: 13,
                  background: "transparent", color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer",
                }}>Отмена</button>
                <button onClick={save} disabled={saving} style={{
                  padding: "10px 22px", fontSize: 13, fontWeight: 500,
                  background: "var(--accent)", color: "white",
                  border: "none", borderRadius: 8, cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}>{saving ? "..." : "Сохранить"}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 10.5, color: "var(--text-tertiary)",
        textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4,
      }}>{label}</label>
      {children}
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px", fontSize: 12, fontWeight: 500,
    background: active ? "var(--accent)" : "var(--bg-elevated)",
    color: active ? "white" : "var(--text-secondary)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
    borderRadius: 7, cursor: "pointer",
  };
}

const inpStyle: React.CSSProperties = {
  width: "100%", padding: "8px 11px", fontSize: 13,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 7, outline: "none",
};
const inpCell: React.CSSProperties = {
  width: "100%", padding: "5px 7px", fontSize: 12,
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid transparent", borderRadius: 4, outline: "none",
};
const btnSecondary: React.CSSProperties = {
  padding: "10px 18px", fontSize: 13, fontWeight: 500,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--accent)", borderRadius: 8, cursor: "pointer",
};
const th: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 500,
  color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em",
};
const td: React.CSSProperties = { padding: "4px 6px", color: "var(--text-primary)" };
