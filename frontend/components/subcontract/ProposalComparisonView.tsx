"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComparisonView, ProposalItem, ProposalStatus } from "@/types/subcontract";

const PROPOSAL_STATUS_COLOR: Record<ProposalStatus, { bg: string; color: string }> = {
  "Получено":         { bg: "rgba(96,165,250,0.14)", color: "#60a5fa" },
  "На рассмотрении":  { bg: "rgba(251,191,36,0.14)", color: "var(--warning)" },
  "Выбрано":          { bg: "rgba(34,197,94,0.18)",  color: "var(--success)" },
  "Отклонено":        { bg: "rgba(120,120,160,0.14)", color: "var(--text-tertiary)" },
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 13, color: "var(--text-primary)",
  background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8,
  outline: "none", width: "100%",
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function ProposalComparisonView({
  bidRequestName,
  onClose,
  onUpdated,
}: {
  bidRequestName: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [data, setData] = useState<ComparisonView | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [awarding, setAwarding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/subcontract-bids/${encodeURIComponent(bidRequestName)}/compare`);
    const d = await r.json();
    setData(d);
    setLoading(false);
  }, [bidRequestName]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !addOpen) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, addOpen]);

  async function awardWinner(proposalName: string) {
    if (!confirm(`Присудить тендер этому подрядчику? Остальные предложения будут отмечены как «Отклонено».`)) return;
    setAwarding(proposalName);
    try {
      const r = await fetch(`/api/subcontract-bids/${encodeURIComponent(bidRequestName)}/winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal: proposalName }),
      });
      if (r.ok) {
        await load();
        onUpdated?.();
      }
    } finally {
      setAwarding(null);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, padding: 32, overflow: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        maxWidth: 1400, margin: "0 auto", background: "var(--bg-base)",
        borderRadius: 14, border: "1px solid var(--border-subtle)", padding: "24px 28px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 500, margin: 0 }}>
              Сравнение предложений
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
              {data?.bid_request.title}
              <span style={{ fontFamily: "monospace", marginLeft: 10 }}>· {bidRequestName}</span>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setAddOpen(true)} style={btnPrimary}>+ Добавить КП</button>
            <button onClick={onClose} style={btnCancel}>Закрыть</button>
          </div>
        </div>

        {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

        {!loading && data && (
          <>
            {/* KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
              <KPI label="Наша оценка" value={fmtMoney(data.bid_request.total_target_amount)} color="var(--text-primary)" />
              <KPI label="Лучшее КП"   value={data.bid_request.best_proposal_amount > 0 ? fmtMoney(data.bid_request.best_proposal_amount) : "—"} color="var(--accent)" />
              <KPI label="Экономия"    value={data.bid_request.savings_amount > 0 ? fmtMoney(data.bid_request.savings_amount) : "—"} color="var(--success)" />
              <KPI label="Экономия %"  value={data.bid_request.savings_pct > 0 ? fmtPct(data.bid_request.savings_pct) : "—"} color="var(--success)" />
            </div>

            {data.proposals.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 12 }}>
                Предложений пока нет. Нажмите «+ Добавить КП», чтобы внести предложение от подрядчика.
              </div>
            )}

            {data.proposals.length > 0 && (
              <div style={{ overflow: "auto", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "var(--bg-elevated)" }}>
                    <tr>
                      <th style={tdH}>Позиция</th>
                      <th style={{ ...tdH, textAlign: "right" }}>Кол-во</th>
                      <th style={{ ...tdH, textAlign: "right", color: "var(--text-secondary)" }}>Наша цена</th>
                      {data.proposals.map(p => (
                        <th key={p.name} style={{ ...tdH, textAlign: "right", minWidth: 140 }}>
                          <div style={{ fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
                            {p.supplier_name_snapshot || p.supplier}
                          </div>
                          <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10,
                                        background: PROPOSAL_STATUS_COLOR[p.status].bg, color: PROPOSAL_STATUS_COLOR[p.status].color }}>
                            {p.status}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.bid_item.name} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <td style={tdC}>
                          <div style={{ fontWeight: 500 }}>{row.bid_item.item_name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace", marginTop: 2 }}>
                            {row.bid_item.item_code} · {row.bid_item.unit}
                          </div>
                        </td>
                        <td style={{ ...tdC, textAlign: "right", fontFamily: "monospace" }}>
                          {row.bid_item.qty.toLocaleString("ru-RU")}
                        </td>
                        <td style={{ ...tdC, textAlign: "right", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                          <div>{row.bid_item.our_unit_price.toLocaleString("ru-RU")}</div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                            {row.bid_item.our_amount.toLocaleString("ru-RU")}
                          </div>
                        </td>
                        {data.proposals.map(p => {
                          const cell = row.prices[p.name];
                          const isCheapest = row.cheapest_proposal === p.name;
                          if (!cell) return <td key={p.name} style={{ ...tdC, textAlign: "right", color: "var(--text-tertiary)" }}>—</td>;
                          const diff = ((cell.unit_price - row.bid_item.our_unit_price) / row.bid_item.our_unit_price) * 100;
                          return (
                            <td key={p.name} style={{
                              ...tdC, textAlign: "right", fontFamily: "monospace",
                              background: isCheapest ? "rgba(34,197,94,0.07)" : "transparent",
                            }}>
                              <div style={{ fontWeight: isCheapest ? 600 : 400, color: isCheapest ? "var(--success)" : "var(--text-primary)" }}>
                                {cell.unit_price.toLocaleString("ru-RU")}
                              </div>
                              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                                {cell.amount.toLocaleString("ru-RU")} · {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--bg-elevated)", borderTop: "2px solid var(--border-subtle)" }}>
                      <td style={{ ...tdC, fontWeight: 500, fontSize: 11, textTransform: "uppercase", color: "var(--text-tertiary)", letterSpacing: "0.05em" }}>
                        Итого
                      </td>
                      <td></td>
                      <td style={{ ...tdC, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "var(--accent)" }}>
                        {data.bid_request.total_target_amount.toLocaleString("ru-RU")} ₽
                      </td>
                      {data.proposals.map(p => {
                        const isBest = data.bid_request.best_proposal_amount === p.total_amount;
                        return (
                          <td key={p.name} style={{
                            ...tdC, textAlign: "right", fontFamily: "monospace",
                            background: isBest ? "rgba(34,197,94,0.1)" : "transparent",
                          }}>
                            <div style={{ fontWeight: 600, color: isBest ? "var(--success)" : "var(--text-primary)" }}>
                              {p.total_amount.toLocaleString("ru-RU")} ₽
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{fmtPct(p.vs_target_pct)}</div>
                          </td>
                        );
                      })}
                    </tr>
                    {/* Кнопки присуждения */}
                    {data.bid_request.status !== "Присуждён" && (
                      <tr>
                        <td colSpan={3} style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, color: "var(--text-tertiary)" }}>
                          Присудить →
                        </td>
                        {data.proposals.map(p => (
                          <td key={p.name} style={{ ...tdC, textAlign: "center" }}>
                            <button
                              onClick={() => awardWinner(p.name)}
                              disabled={awarding === p.name || p.status === "Отклонено"}
                              style={{
                                padding: "6px 10px", fontSize: 11, fontWeight: 500, borderRadius: 6,
                                background: p.status === "Отклонено" ? "var(--bg-elevated)" : "var(--accent)",
                                color: p.status === "Отклонено" ? "var(--text-tertiary)" : "white",
                                border: "none", cursor: p.status === "Отклонено" ? "not-allowed" : "pointer",
                                opacity: awarding === p.name ? 0.6 : 1,
                              }}>
                              {awarding === p.name ? "..." : "Выбрать"}
                            </button>
                          </td>
                        ))}
                      </tr>
                    )}
                    {data.bid_request.status === "Присуждён" && data.bid_request.awarded_to && (
                      <tr>
                        <td colSpan={3 + data.proposals.length} style={{ padding: "10px 14px", background: "rgba(34,197,94,0.08)", color: "var(--success)", fontWeight: 500, fontSize: 12 }}>
                          ✓ Тендер присуждён: <strong>{data.bid_request.awarded_to}</strong>
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}

        {addOpen && data && (
          <AddProposalDrawer
            bidRequestName={bidRequestName}
            bidItems={data.rows.map(r => r.bid_item)}
            onClose={() => setAddOpen(false)}
            onSaved={() => { setAddOpen(false); load(); onUpdated?.(); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Drawer добавления КП от подрядчика ───────────────────────────────────────
function AddProposalDrawer({
  bidRequestName,
  bidItems,
  onClose,
  onSaved,
}: {
  bidRequestName: string;
  bidItems: { name: string; item_code?: string; item_name: string; unit?: string; qty: number; our_unit_price: number }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [suppliers, setSuppliers] = useState<{ name: string; supplier_name: string }[]>([]);
  const [supplierQ, setSupplierQ] = useState("");
  const [items, setItems] = useState<ProposalItem[]>(() =>
    bidItems.map(bi => ({
      linked_bid_item: bi.name,
      item_name: bi.item_name,
      unit: bi.unit,
      qty: bi.qty,
      supplier_unit_price: 0,
    }))
  );
  const [form, setForm] = useState({
    supplier: "",
    status: "Получено" as ProposalStatus,
    received_date: new Date().toISOString().slice(0, 10),
    valid_until: "",
    delivery_terms: "",
    payment_terms: "",
    contact_phone: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuppliers = useCallback(async (q: string) => {
    const r = await fetch(`/api/suppliers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const d = await r.json();
    setSuppliers(Array.isArray(d) ? d : []);
  }, []);

  useEffect(() => { loadSuppliers(""); }, [loadSuppliers]);

  useEffect(() => {
    const t = setTimeout(() => loadSuppliers(supplierQ), 250);
    return () => clearTimeout(t);
  }, [supplierQ, loadSuppliers]);

  const total = items.reduce((s, it) => s + (it.qty || 0) * (it.supplier_unit_price || 0), 0);
  const targetTotal = bidItems.reduce((s, bi) => s + bi.qty * bi.our_unit_price, 0);
  const vsTarget = targetTotal > 0 ? (total / targetTotal) * 100 : 0;

  async function save() {
    if (!form.supplier) { setError("Выберите поставщика"); return; }
    if (items.every(it => !it.supplier_unit_price)) { setError("Заполните цены хотя бы по одной позиции"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        bid_request: bidRequestName,
        ...form,
        items: items.filter(it => it.supplier_unit_price > 0),
      };
      const r = await fetch(`/api/subcontract-bids/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setError(d.error || "Ошибка сохранения"); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 720, maxWidth: "100%", height: "100vh", background: "var(--bg-base)",
        borderLeft: "1px solid var(--border-subtle)", overflow: "auto", padding: "24px 28px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 500, margin: 0 }}>Новое КП от подрядчика</h2>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>Для тендера {bidRequestName}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Подрядчик *</label>
          <input
            list="suppliers-list"
            style={inputStyle}
            value={form.supplier}
            onChange={(e) => setForm(f => ({ ...f, supplier: e.target.value }))}
            onInput={(e) => setSupplierQ((e.target as HTMLInputElement).value)}
            placeholder="Начните печатать..."
          />
          <datalist id="suppliers-list">
            {suppliers.map(s => <option key={s.name} value={s.name}>{s.supplier_name}</option>)}
          </datalist>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Получено</label>
            <input type="date" style={inputStyle} value={form.received_date}
                   onChange={(e) => setForm(f => ({ ...f, received_date: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Действует до</label>
            <input type="date" style={inputStyle} value={form.valid_until}
                   onChange={(e) => setForm(f => ({ ...f, valid_until: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Телефон</label>
            <input style={inputStyle} value={form.contact_phone}
                   onChange={(e) => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+7 ..." />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Срок выполнения</label>
            <input style={inputStyle} value={form.delivery_terms}
                   onChange={(e) => setForm(f => ({ ...f, delivery_terms: e.target.value }))} placeholder="напр. 30 рабочих дней" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Условия оплаты</label>
            <input style={inputStyle} value={form.payment_terms}
                   onChange={(e) => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="напр. Аванс 30%" />
          </div>
        </div>

        <h3 style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontFamily: "monospace" }}>Цены по позициям</h3>

        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "var(--bg-base)" }}>
              <tr>
                <th style={{ ...tdH, width: "50%" }}>Позиция</th>
                <th style={{ ...tdH, textAlign: "right" }}>Кол-во</th>
                <th style={{ ...tdH, textAlign: "right" }}>Цена ₽</th>
                <th style={{ ...tdH, textAlign: "right" }}>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const amount = (it.qty || 0) * (it.supplier_unit_price || 0);
                return (
                  <tr key={i} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td style={tdC}>
                      <div style={{ fontWeight: 500 }}>{it.item_name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{it.unit}</div>
                    </td>
                    <td style={{ ...tdC, textAlign: "right", fontFamily: "monospace" }}>{it.qty.toLocaleString("ru-RU")}</td>
                    <td style={tdC}>
                      <input type="number" style={{ ...inputStyle, padding: "4px 6px", fontSize: 12, textAlign: "right" }}
                             value={it.supplier_unit_price || ""}
                             onChange={(e) => setItems(prev => prev.map((p, idx) => idx === i ? { ...p, supplier_unit_price: parseFloat(e.target.value) || 0 } : p))} />
                    </td>
                    <td style={{ ...tdC, textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                      {amount.toLocaleString("ru-RU")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--bg-base)", borderTop: "1px solid var(--border-subtle)" }}>
                <td colSpan={3} style={{ ...tdC, textAlign: "right", color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Итого {total > 0 && targetTotal > 0 && (
                    <span style={{ marginLeft: 8, color: vsTarget < 100 ? "var(--success)" : vsTarget > 100 ? "var(--warning)" : "var(--text-tertiary)" }}>
                      ({fmtPct(vsTarget)} к нашей оценке)
                    </span>
                  )}
                </td>
                <td style={{ ...tdC, textAlign: "right", fontFamily: "monospace", fontWeight: 600, fontSize: 14, color: "var(--accent)" }}>
                  {total.toLocaleString("ru-RU")} ₽
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Заметки</label>
          <textarea style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }}
                    value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        {error && <div style={{ padding: 10, marginTop: 10, background: "rgba(248,113,113,0.1)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", fontSize: 12 }}>{error}</div>}

        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={btnCancel}>Отмена</button>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Сохранение..." : "Сохранить КП"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
const KPI = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ padding: "10px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
    <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>{label}</p>
    <p style={{ fontSize: 17, fontWeight: 600, color, margin: "4px 0 0", fontFamily: "monospace" }}>{value}</p>
  </div>
);

const tdH: React.CSSProperties = { padding: "8px 10px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" };
const tdC: React.CSSProperties = { padding: "8px 10px", color: "var(--text-primary)", verticalAlign: "top" };
const btnPrimary: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" };
const btnCancel: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", cursor: "pointer" };
