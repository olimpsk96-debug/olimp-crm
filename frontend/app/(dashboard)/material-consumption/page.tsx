"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface Consumption {
  name: string;
  project: string;
  project_title: string;
  consumed_date: string;
  foreman_name: string;
  stock_item: string | null;
  stock_item_name?: string;
  material_name_text: string;
  qty: number;
  unit: string;
  unit_price: number;
  amount: number;
  status: string;
  stock_movement_ref: string | null;
  notes: string;
}

interface Summary {
  by_project: {
    project: string;
    project_title: string;
    written_off: number;
    confirmed: number;
    draft: number;
    total_amount: number;
    draft_count: number;
  }[];
  totals: { written_off: number; confirmed: number; draft: number; total_count: number };
  period_days: number;
}

interface StockItem {
  name: string;
  item_name: string;
  item_code: string;
  unit: string;
  current_qty: number;
  avg_price: number;
}

interface Project { name: string; title?: string; }

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

function statusColor(s: string): string {
  if (s === "Списан со склада") return "var(--success)";
  if (s === "Подтверждён") return "#3b82f6";
  if (s === "Отклонён") return "var(--danger)";
  return "#eab308";
}
function statusBg(s: string): string {
  if (s === "Списан со склада") return "rgba(74,222,128,0.10)";
  if (s === "Подтверждён") return "rgba(96,165,250,0.10)";
  if (s === "Отклонён") return "rgba(248,113,113,0.10)";
  return "rgba(234,179,8,0.10)";
}

export default function MaterialConsumptionPage() {
  const toast = useToast();
  const [items, setItems] = useState<Consumption[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState({ project: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Partial<Consumption> | null>(null);

  function reload() {
    setLoading(true);
    const p = new URLSearchParams({ days: "90" });
    if (filter.project) p.set("project", filter.project);
    if (filter.status) p.set("status", filter.status);

    Promise.all([
      fetch(`/api/material-consumption?${p}`).then((r) => r.json()),
      fetch("/api/material-consumption?mode=summary&days=90").then((r) => r.json()),
    ])
      .then(([i, s]) => {
        setItems(Array.isArray(i) ? i : []);
        setSummary(s && !s.error ? s : null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setProjects(d.map((p: { name: string; title?: string }) => ({ name: p.name, title: p.title })));
    }).catch(() => {});
  }, []);
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function action(actName: "confirm" | "writeoff" | "reject", name: string) {
    const body: Record<string, string> = { action: actName, name };
    if (actName === "reject") {
      const reason = window.prompt("Причина отклонения?");
      if (!reason) return;
      body.reason = reason;
    }
    if (actName === "writeoff" && !window.confirm("Списать материал со склада? Будет создан Stock Movement расход.")) return;
    const r = await fetch("/api/material-consumption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else {
      const msg = actName === "writeoff"
        ? `Списано: создан ${d.stock_movement}`
        : actName === "confirm" ? "Подтверждено" : "Отклонено";
      toast.success(msg);
      reload();
    }
  }

  async function deleteItem(name: string) {
    if (!window.confirm("Удалить запись?")) return;
    const r = await fetch(`/api/material-consumption?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success("Удалено"); reload(); }
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Расход материалов</h1>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
            Прорабы фиксируют расход на объекте · авто-списание со склада при подтверждении
          </div>
        </div>
        <button onClick={() => setEditor({ status: "Черновик", consumed_date: new Date().toISOString().substring(0, 10) })}
                style={{
                  padding: "10px 18px", fontSize: 13, fontWeight: 500,
                  background: "var(--accent)", color: "white",
                  border: "none", borderRadius: 8, cursor: "pointer",
                }}>
          + Расход
        </button>
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Списано (90 дн.)", value: fmtMoney(summary.totals.written_off), color: "var(--success)" },
            { label: "Подтверждено к списанию", value: fmtMoney(summary.totals.confirmed), color: "#3b82f6" },
            { label: "Черновики", value: fmtMoney(summary.totals.draft), color: "#eab308" },
            { label: "Всего записей", value: String(summary.totals.total_count), color: "var(--text-primary)" },
          ].map((k) => (
            <div key={k.label} style={{
              padding: 14, borderRadius: 10,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={filter.project} onChange={(e) => setFilter({ ...filter, project: e.target.value })}
                style={selStyle}>
          <option value="">Все проекты</option>
          {projects.map((p) => <option key={p.name} value={p.name}>{p.title || p.name}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                style={selStyle}>
          <option value="">Все статусы</option>
          <option>Черновик</option>
          <option>Подтверждён</option>
          <option>Списан со склада</option>
          <option>Отклонён</option>
        </select>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && items.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
          Записей нет
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{
          background: "var(--bg-elevated)", borderRadius: 10,
          border: "1px solid var(--border-subtle)", overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={thStyle}>Дата</th>
                <th style={thStyle}>Проект</th>
                <th style={thStyle}>Материал</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Кол-во</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Сумма</th>
                <th style={thStyle}>Прораб</th>
                <th style={thStyle}>Статус</th>
                <th style={{ ...thStyle, width: 130 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.name} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={tdStyle}>{it.consumed_date}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{it.project}</td>
                  <td style={tdStyle}>
                    {it.stock_item ? (
                      <span><span style={{ color: "var(--success)" }}>📦</span> {it.stock_item_name || it.stock_item}</span>
                    ) : (
                      <span style={{ color: "var(--text-secondary)" }}>📝 {it.material_name_text}</span>
                    )}
                    {it.stock_movement_ref && (
                      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
                        → {it.stock_movement_ref}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace" }}>
                    {it.qty} {it.unit}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                    {fmtMoney(it.amount)}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{it.foreman_name || "—"}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500,
                      background: statusBg(it.status), color: statusColor(it.status),
                      border: `1px solid ${statusColor(it.status)}`,
                    }}>
                      {it.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    {it.status === "Черновик" && (
                      <>
                        <button onClick={() => action("confirm", it.name)} title="Подтвердить" style={btnIcon("#3b82f6")}>✓</button>
                        <button onClick={() => action("reject", it.name)} title="Отклонить" style={btnIcon("var(--danger)")}>×</button>
                      </>
                    )}
                    {it.status === "Подтверждён" && it.stock_item && (
                      <button onClick={() => action("writeoff", it.name)} title="Списать со склада" style={{ ...btnIcon("var(--success)"), padding: "3px 9px", fontSize: 11 }}>
                        📦↓
                      </button>
                    )}
                    {it.status !== "Списан со склада" && (
                      <>
                        <button onClick={() => setEditor(it)} title="Изменить" style={btnIcon("var(--text-tertiary)")}>✎</button>
                        <button onClick={() => deleteItem(it.name)} title="Удалить" style={btnIcon("var(--danger)")}>🗑</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor && (
        <ConsumptionEditor item={editor} projects={projects}
                           onClose={() => setEditor(null)}
                           onSaved={() => { setEditor(null); reload(); }} />
      )}
    </div>
  );
}

function ConsumptionEditor({ item, projects, onClose, onSaved }: {
  item: Partial<Consumption>;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Consumption>>(item);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockSearch, setStockSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams({ limit: "80" });
    if (stockSearch) p.set("search", stockSearch);
    fetch(`/api/stock?${p}`)
      .then((r) => r.json())
      .then((d) => setStockItems(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [stockSearch]);

  async function save() {
    if (!f.project) { toast.warn("Выберите проект"); return; }
    if (!f.qty || f.qty <= 0) { toast.warn("Количество > 0"); return; }
    if (!f.stock_item && !(f.material_name_text || "").trim()) {
      toast.warn("Укажите материал со склада или название текстом"); return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/material-consumption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", ...f }),
      });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(d.action === "created" ? `Создано (${d.amount?.toFixed(0)} ₽)` : "Обновлено");
      onSaved();
    } finally { setSaving(false); }
  }

  const selectedSI = stockItems.find((s) => s.name === f.stock_item);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 100,
      padding: "60px 20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 600, maxHeight: "85vh", overflowY: "auto",
        background: "var(--bg-base)", borderRadius: 12,
        border: "1px solid var(--border-subtle)", padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>
            {item.name ? "Редактирование расхода" : "Новый расход материала"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Проект *">
            <select value={f.project || ""} onChange={(e) => setF({ ...f, project: e.target.value })} style={inpStyle}>
              <option value="">— не выбран —</option>
              {projects.map((p) => <option key={p.name} value={p.name}>{p.title || p.name}</option>)}
            </select>
          </Field>
          <Field label="Дата">
            <input type="date" value={(f.consumed_date as string) || ""}
                   onChange={(e) => setF({ ...f, consumed_date: e.target.value })} style={inpStyle} />
          </Field>
        </div>

        <Field label="Материал со склада (опционально)">
          <input type="text" value={stockSearch} onChange={(e) => setStockSearch(e.target.value)}
                 placeholder="Поиск по складу..." style={inpStyle} />
          <select value={f.stock_item || ""}
                  onChange={(e) => {
                    const si = stockItems.find((s) => s.name === e.target.value);
                    setF({
                      ...f,
                      stock_item: e.target.value || null,
                      material_name_text: si?.item_name || f.material_name_text,
                      unit: si?.unit || f.unit,
                      unit_price: si?.avg_price || f.unit_price || 0,
                    });
                  }}
                  style={{ ...inpStyle, marginTop: 4 }}>
            <option value="">— не выбран (введите название ниже) —</option>
            {stockItems.map((s) => (
              <option key={s.name} value={s.name}>
                {s.item_name} ({s.current_qty} {s.unit}, {s.avg_price ? `${Math.round(s.avg_price)} ₽` : "без цены"})
              </option>
            ))}
          </select>
          {selectedSI && (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              Остаток на складе: <b>{selectedSI.current_qty} {selectedSI.unit}</b> ·
              цена: <b>{selectedSI.avg_price ? `${Math.round(selectedSI.avg_price)} ₽` : "не задана"}</b>
              {f.qty && selectedSI.current_qty < (f.qty as number) && (
                <span style={{ color: "var(--danger)", marginLeft: 8 }}>⚠ Недостаточно на складе</span>
              )}
            </div>
          )}
        </Field>
        <div style={{ height: 12 }} />

        <Field label="Название (или если нет на складе)">
          <input type="text" value={f.material_name_text || ""}
                 onChange={(e) => setF({ ...f, material_name_text: e.target.value })}
                 placeholder="Цемент М500 / Гвозди оцинкованные 5мм / Грунт ГФ-021"
                 style={inpStyle} />
        </Field>
        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Количество *">
            <input type="number" min={0} step={0.01} value={f.qty ?? ""}
                   onChange={(e) => setF({ ...f, qty: parseFloat(e.target.value) || 0 })} style={inpStyle} />
          </Field>
          <Field label="Ед. изм.">
            <input type="text" value={f.unit || ""}
                   onChange={(e) => setF({ ...f, unit: e.target.value })}
                   placeholder="кг / м3 / шт" style={inpStyle} />
          </Field>
          <Field label="Цена за ед. ₽">
            <input type="number" min={0} step={0.01} value={f.unit_price ?? ""}
                   onChange={(e) => setF({ ...f, unit_price: parseFloat(e.target.value) || 0 })} style={inpStyle} />
          </Field>
        </div>

        {f.qty && f.unit_price ? (
          <div style={{
            padding: "8px 12px", marginBottom: 12, borderRadius: 8,
            background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)",
            fontSize: 13, fontFamily: "monospace",
          }}>
            Сумма: <b>{fmtMoney((f.qty || 0) * (f.unit_price || 0))}</b>
          </div>
        ) : null}

        <Field label="Прораб">
          <input type="text" value={f.foreman_name || ""}
                 onChange={(e) => setF({ ...f, foreman_name: e.target.value })}
                 placeholder="Иванов И.И." style={inpStyle} />
        </Field>
        <div style={{ height: 12 }} />

        <Field label="Комментарий">
          <textarea value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })}
                    style={{ ...inpStyle, minHeight: 60, fontFamily: "inherit", resize: "vertical" }} />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{
            padding: "10px 18px", fontSize: 13,
            background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer",
          }}>
            Отмена
          </button>
          <button onClick={save} disabled={saving} style={{
            padding: "10px 22px", fontSize: 13, fontWeight: 500,
            background: "var(--accent)", color: "white",
            border: "none", borderRadius: 8, cursor: "pointer",
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? "..." : "Сохранить"}
          </button>
        </div>
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

const inpStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", fontSize: 13,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 7,
  outline: "none",
};
const selStyle: React.CSSProperties = {
  padding: "7px 10px", fontSize: 12,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 6,
  outline: "none", cursor: "pointer",
};
const thStyle: React.CSSProperties = {
  padding: "9px 10px", textAlign: "left", fontSize: 11, fontWeight: 500,
  color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em",
};
const tdStyle: React.CSSProperties = {
  padding: "10px 10px", color: "var(--text-primary)",
};
function btnIcon(color: string): React.CSSProperties {
  return {
    padding: "3px 7px", fontSize: 13, marginRight: 3,
    background: "transparent", color,
    border: "1px solid var(--border-subtle)", borderRadius: 5, cursor: "pointer",
  };
}
