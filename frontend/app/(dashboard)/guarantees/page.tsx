"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface Guarantee {
  name: string;
  tender: string;
  tender_title?: string;
  tender_status?: string;
  tender_law?: string;
  guarantee_type: string;
  guarantee_number: string;
  amount: number;
  issue_date: string;
  expiry_date: string;
  status: string;
  bank_name: string;
  commission_pct: number;
  commission_amount: number;
  notes: string;
  days_to_expiry: number | null;
}

interface Summary {
  by_type: Record<string, { count: number; amount: number; commission: number }>;
  totals: { amount_frozen: number; commission_paid: number; active_count: number };
  expiring_30d: Array<{ name: string; tender: string; tender_title?: string;
                       guarantee_type: string; amount: number; expiry_date: string;
                       days_left: number; bank_name: string }>;
}

interface Tender { name: string; title?: string; }

const GUARANTEE_TYPES = [
  "Обеспечение заявки", "Обеспечение контракта", "Банковская гарантия",
  "СРО взнос", "Гарантийные обязательства",
];
const STATUSES = ["Активна", "Истекла", "Возвращена", "Использована", "Аннулирована"];

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

function expiryColor(days: number | null): string {
  if (days === null) return "var(--text-tertiary)";
  if (days < 0) return "var(--danger)";
  if (days <= 7) return "var(--danger)";
  if (days <= 30) return "#eab308";
  return "var(--success)";
}

function statusColor(s: string): string {
  if (s === "Активна") return "var(--success)";
  if (s === "Истекла") return "var(--danger)";
  if (s === "Возвращена") return "#3b82f6";
  if (s === "Использована") return "var(--text-tertiary)";
  return "#eab308";
}

export default function GuaranteesPage() {
  const toast = useToast();
  const [items, setItems] = useState<Guarantee[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [filter, setFilter] = useState({ status: "", guarantee_type: "" });
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Partial<Guarantee> | null>(null);

  function reload() {
    setLoading(true);
    const p = new URLSearchParams();
    if (filter.status) p.set("status", filter.status);
    if (filter.guarantee_type) p.set("guarantee_type", filter.guarantee_type);

    Promise.all([
      fetch(`/api/guarantees?${p}`).then((r) => r.json()),
      fetch("/api/guarantees?mode=summary").then((r) => r.json()),
    ])
      .then(([i, s]) => {
        setItems(Array.isArray(i) ? i : []);
        setSummary(s && !s.error ? s : null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/tenders").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setTenders(d.map((t: { name: string; title?: string }) => ({ name: t.name, title: t.title })));
    }).catch(() => {});
  }, []);

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function deleteItem(name: string) {
    if (!window.confirm("Удалить запись обеспечения?")) return;
    const r = await fetch(`/api/guarantees?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success("Удалено"); reload(); }
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Обеспечения тендеров</h1>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
            44-ФЗ / 223-ФЗ: обеспечения заявок/контрактов, БГ, СРО · Telegram-алерт за 30/7/1 день до истечения
          </div>
        </div>
        <button onClick={() => setEditor({ guarantee_type: "Обеспечение заявки", status: "Активна",
                                            issue_date: new Date().toISOString().substring(0, 10) })}
                style={{
                  padding: "10px 18px", fontSize: 13, fontWeight: 500,
                  background: "var(--accent)", color: "white",
                  border: "none", borderRadius: 8, cursor: "pointer",
                }}>
          + Обеспечение
        </button>
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Заморожено в обеспечениях", value: fmtMoney(summary.totals.amount_frozen), color: "var(--text-primary)" },
            { label: "Уплачено комиссий банкам", value: fmtMoney(summary.totals.commission_paid), color: "var(--danger)" },
            { label: "Активных обеспечений", value: String(summary.totals.active_count), color: "var(--success)" },
            { label: "Истекают в 30 дней", value: String(summary.expiring_30d.length),
              color: summary.expiring_30d.length > 0 ? "#eab308" : "var(--text-tertiary)" },
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

      {/* Expiring alert */}
      {summary && summary.expiring_30d.length > 0 && (
        <div style={{
          padding: 12, marginBottom: 14, borderRadius: 10,
          background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.4)",
        }}>
          <div style={{ fontSize: 11.5, color: "#a16207", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "monospace" }}>
            ⏰ Скоро истекают ({summary.expiring_30d.length})
          </div>
          {summary.expiring_30d.slice(0, 5).map((e) => (
            <div key={e.name} style={{ fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: expiryColor(e.days_left), fontWeight: 600 }}>
                {e.days_left <= 1 ? "🔴" : e.days_left <= 7 ? "🟠" : "🟡"} {e.days_left} дн.
              </span>
              {" · "}
              <span>{e.guarantee_type}</span>
              {" · "}
              <span style={{ fontFamily: "monospace" }}>{fmtMoney(e.amount)}</span>
              {" · "}
              <span style={{ color: "var(--text-secondary)" }}>{e.tender_title || e.tender}</span>
              {e.bank_name && <span style={{ color: "var(--text-tertiary)" }}> · {e.bank_name}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                style={selStyle}>
          <option value="">Все статусы</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.guarantee_type} onChange={(e) => setFilter({ ...filter, guarantee_type: e.target.value })}
                style={selStyle}>
          <option value="">Все типы</option>
          {GUARANTEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && items.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
          Обеспечений нет
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
                <th style={thStyle}>Тип</th>
                <th style={thStyle}>№ / Банк</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Сумма</th>
                <th style={thStyle}>До</th>
                <th style={thStyle}>Тендер</th>
                <th style={thStyle}>Статус</th>
                <th style={{ ...thStyle, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.name} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "1px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                      background: it.guarantee_type === "Банковская гарантия" ? "rgba(96,165,250,0.15)"
                                  : it.guarantee_type === "СРО взнос" ? "rgba(167,139,250,0.15)"
                                  : "rgba(74,222,128,0.15)",
                      color: it.guarantee_type === "Банковская гарантия" ? "#3b82f6"
                            : it.guarantee_type === "СРО взнос" ? "#7c3aed"
                            : "var(--success)",
                    }}>
                      {it.guarantee_type}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11.5 }}>
                    {it.guarantee_number || "—"}
                    {it.bank_name && (
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                        {it.bank_name}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                    {fmtMoney(it.amount)}
                    {it.commission_amount > 0 && (
                      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 1 }}>
                        комиссия {fmtMoney(it.commission_amount)} ({it.commission_pct}%)
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ color: expiryColor(it.days_to_expiry), fontWeight: 500 }}>
                      {it.expiry_date}
                    </div>
                    {it.days_to_expiry !== null && (
                      <div style={{ fontSize: 11, color: expiryColor(it.days_to_expiry) }}>
                        {it.days_to_expiry > 0 ? `${it.days_to_expiry} дн.` :
                          it.days_to_expiry === 0 ? "сегодня!" : `${-it.days_to_expiry} дн. назад`}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div>{it.tender_title || it.tender}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1, fontFamily: "monospace" }}>
                      {it.tender_law} {it.tender_status && `· ${it.tender_status}`}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500,
                      background: "transparent", color: statusColor(it.status),
                      border: `1px solid ${statusColor(it.status)}`,
                    }}>
                      {it.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <button onClick={() => setEditor(it)} title="Изменить" style={btnIcon("var(--text-tertiary)")}>✎</button>
                    <button onClick={() => deleteItem(it.name)} title="Удалить" style={btnIcon("var(--danger)")}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor && (
        <Editor item={editor} tenders={tenders}
                onClose={() => setEditor(null)}
                onSaved={() => { setEditor(null); reload(); }} />
      )}
    </div>
  );
}

function Editor({ item, tenders, onClose, onSaved }: {
  item: Partial<Guarantee>;
  tenders: Tender[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Guarantee>>(item);
  const [saving, setSaving] = useState(false);

  // Авторасчёт комиссии для БГ
  useEffect(() => {
    if (f.guarantee_type === "Банковская гарантия" && f.amount && f.commission_pct) {
      const calc = (f.amount as number) * (f.commission_pct as number) / 100;
      if (Math.abs((f.commission_amount || 0) - calc) > 0.01) {
        setF((prev) => ({ ...prev, commission_amount: calc }));
      }
    }
  }, [f.guarantee_type, f.amount, f.commission_pct, f.commission_amount]);

  async function save() {
    if (!f.tender) { toast.warn("Выберите тендер"); return; }
    if (!f.amount || f.amount <= 0) { toast.warn("Сумма > 0"); return; }
    if (!f.expiry_date) { toast.warn("Срок действия обязателен"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/guarantees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(d.action === "created" ? "Создано" : "Обновлено");
      onSaved();
    } finally { setSaving(false); }
  }

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
            {item.name ? "Редактирование обеспечения" : "Новое обеспечение"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Тендер *">
            <select value={f.tender || ""} onChange={(e) => setF({ ...f, tender: e.target.value })} style={inpStyle}>
              <option value="">— не выбран —</option>
              {tenders.map((t) => <option key={t.name} value={t.name}>{t.title || t.name}</option>)}
            </select>
          </Field>
          <Field label="Тип *">
            <select value={f.guarantee_type || "Обеспечение заявки"}
                    onChange={(e) => setF({ ...f, guarantee_type: e.target.value })} style={inpStyle}>
              {GUARANTEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="№ гарантии / документа">
            <input type="text" value={f.guarantee_number || ""}
                   onChange={(e) => setF({ ...f, guarantee_number: e.target.value })}
                   placeholder="БГ-77-12345 / СРО-2026-04"
                   style={{ ...inpStyle, fontFamily: "monospace" }} />
          </Field>
          <Field label="Сумма обеспечения *">
            <input type="number" min={0} step={100} value={f.amount ?? ""}
                   onChange={(e) => setF({ ...f, amount: parseFloat(e.target.value) || 0 })} style={inpStyle} />
          </Field>
          <Field label="Дата выдачи">
            <input type="date" value={(f.issue_date as string) || ""}
                   onChange={(e) => setF({ ...f, issue_date: e.target.value })} style={inpStyle} />
          </Field>
          <Field label="Действует до *">
            <input type="date" value={(f.expiry_date as string) || ""}
                   onChange={(e) => setF({ ...f, expiry_date: e.target.value })} style={inpStyle} />
          </Field>
        </div>

        {f.guarantee_type === "Банковская гарантия" && (
          <div style={{
            padding: 12, marginBottom: 12, borderRadius: 8,
            background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.3)",
          }}>
            <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "monospace" }}>
              Реквизиты банковской гарантии
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <Field label="Банк-гарант">
                <input type="text" value={f.bank_name || ""}
                       onChange={(e) => setF({ ...f, bank_name: e.target.value })}
                       placeholder="Сбербанк / Газпромбанк"
                       style={inpStyle} />
              </Field>
              <Field label="Комиссия, %">
                <input type="number" min={0} step={0.01} value={f.commission_pct ?? ""}
                       onChange={(e) => setF({ ...f, commission_pct: parseFloat(e.target.value) || 0 })}
                       style={inpStyle} />
              </Field>
              <Field label="Стоимость БГ">
                <input type="number" min={0} step={100} value={f.commission_amount ?? ""}
                       onChange={(e) => setF({ ...f, commission_amount: parseFloat(e.target.value) || 0 })}
                       style={inpStyle} />
              </Field>
            </div>
          </div>
        )}

        <Field label="Статус">
          <select value={f.status || "Активна"} onChange={(e) => setF({ ...f, status: e.target.value })} style={inpStyle}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <div style={{ height: 12 }} />

        <Field label="Заметки">
          <textarea value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })}
                    style={{ ...inpStyle, minHeight: 60, fontFamily: "inherit", resize: "vertical" }} />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
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
