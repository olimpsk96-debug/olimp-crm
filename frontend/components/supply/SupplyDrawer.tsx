"use client";

import { useEffect, useState } from "react";
import type { MaterialRequest, SupplyStatus } from "@/types/supply";

interface Props {
  name: string | null;
  onClose: () => void;
  onStatusChange?: (name: string, status: SupplyStatus) => void;
}

const STATUS_OPTIONS: SupplyStatus[] = [
  "Черновик", "Отправлена", "Одобрена", "Закупается", "Получена", "Отменена",
];

const STATUS_COLOR: Record<string, string> = {
  "Черновик":    "var(--text-tertiary)",
  "Отправлена":  "var(--info)",
  "Одобрена":    "var(--warning)",
  "Закупается":  "var(--accent)",
  "Получена":    "var(--success)",
  "Отменена":    "var(--danger)",
};

const PRIORITY_COLOR: Record<string, string> = {
  "Обычная":     "var(--text-tertiary)",
  "Срочная":     "var(--warning)",
  "Критическая": "var(--danger)",
};

function fmt(v?: number | null, digits = 0) {
  if (!v && v !== 0) return "—";
  return v.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtMln(v?: number | null) {
  if (!v) return "—";
  return `${(v / 1_000_000).toFixed(2)} млн ₽`;
}

const miniInput: React.CSSProperties = {
  width: "100%", padding: "6px 10px", marginBottom: 6,
  background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
  borderRadius: 6, color: "var(--text-primary)", fontSize: 12, outline: "none",
};

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", flexShrink: 0, marginRight: 16 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", textAlign: "right", fontFamily: typeof value === "number" ? "monospace" : undefined }}>{value}</span>
    </div>
  );
}

interface ReceivePreview {
  mr: string;
  items: { item_name: string; unit?: string; qty: number; unit_price?: number; stock_item: string | null; stock_item_current_qty?: number; match_type: string }[];
  existing_movements: number;
  can_receive: boolean;
}

export function SupplyDrawer({ name, onClose, onStatusChange }: Props) {
  const [req, setReq] = useState<MaterialRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ReceivePreview | null>(null);
  const [showReceive, setShowReceive] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ supplier_name: "", invoice_number: "", responsible: "" });
  const [receiving, setReceiving] = useState(false);

  // Подтягиваем preview при открытии drawer
  useEffect(() => {
    if (!name) { setPreview(null); return; }
    fetch(`/api/stock/preview-mr?mr=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((p) => setPreview(p?.mr ? p : null))
      .catch(() => setPreview(null));
  }, [name, req?.status]);

  async function handleReceive() {
    if (!req) return;
    setReceiving(true);
    try {
      const res = await fetch("/api/stock/receive-mr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mr_name: req.name, ...receiveForm }),
      });
      const data = await res.json();
      if (data?.ok) {
        setShowReceive(false);
        setPreview(null);
        // Обновим preview
        fetch(`/api/stock/preview-mr?mr=${encodeURIComponent(req.name)}`)
          .then((r) => r.json())
          .then((p) => setPreview(p?.mr ? p : null));
        alert(`Оприходовано ${data.items_received} позиций (новых карточек: ${data.new_stock_items})`);
      } else {
        alert(`Ошибка: ${data?.error || "не удалось оприходовать"}`);
      }
    } finally {
      setReceiving(false);
    }
  }

  useEffect(() => {
    if (!name) { setReq(null); return; }
    setLoading(true);
    fetch(`/api/supply/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then(setReq)
      .finally(() => setLoading(false));
  }, [name]);

  async function handleStatusChange(newStatus: SupplyStatus) {
    if (!req) return;
    setSaving(true);
    try {
      await fetch(`/api/supply/${encodeURIComponent(req.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setReq((r) => r ? { ...r, status: newStatus } : r);
      onStatusChange?.(req.name, newStatus);
    } finally {
      setSaving(false);
    }
  }

  const isOpen = !!name;
  const items = req?.items ?? [];
  const totalRows = items.filter((i) => !!(i.qty));

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.45)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
          backdropFilter: "blur(2px)",
        }}
      />

      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 560, zIndex: 50,
        background: "var(--bg-elevated)",
        borderLeft: "1px solid var(--border-subtle)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Шапка */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ height: 20, borderRadius: 6, background: "var(--border-subtle)", width: "70%" }} />
              ) : (
                <h2 style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, letterSpacing: "-0.01em" }}>
                  {req?.title ?? "—"}
                </h2>
              )}
              {req && (
                <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "monospace" }}>
                  {req.name}
                  {req.priority && req.priority !== "Обычная" && (
                    <span style={{ marginLeft: 8, color: PRIORITY_COLOR[req.priority], fontWeight: 600 }}>
                      · {req.priority}
                    </span>
                  )}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>

          {req && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Статус:</span>
              <select
                value={req.status}
                disabled={saving}
                onChange={(e) => handleStatusChange(e.target.value as SupplyStatus)}
                style={{
                  fontSize: 12, padding: "3px 8px", borderRadius: 7,
                  border: `1px solid ${STATUS_COLOR[req.status] ?? "var(--border-subtle)"}`,
                  background: "transparent",
                  color: STATUS_COLOR[req.status] ?? "var(--text-primary)",
                  cursor: "pointer", outline: "none",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 13 }}>Загрузка...</div>
        )}

        {req && !loading && (
          <>
            {/* KPI */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
              <KpiCell label="Позиций" value={String(totalRows.length)} />
              <KpiCell label="Сумма (оценка)" value={fmtMln(req.total_estimated)} accent="var(--accent)" />
              {req.needed_by_date && (
                <KpiCell label="Нужно к" value={new Date(req.needed_by_date).toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "2-digit" })} />
              )}
            </div>

            {/* Детали */}
            <div style={{ padding: "16px 24px" }}>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 8 }}>Параметры</p>
              <Row label="Проект" value={req.project} />
              <Row label="Запросил" value={req.requested_by} />
              <Row label="Дата заявки" value={req.request_date} />
              {req.notes && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {req.notes}
                </div>
              )}
            </div>

            {/* Таблица позиций */}
            {items.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,2fr) 80px 70px 90px 90px",
                  padding: "9px 24px",
                  fontSize: 10, fontFamily: "monospace",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  color: "var(--text-tertiary)",
                  background: "var(--bg-base)",
                  borderBottom: "1px solid var(--border-subtle)",
                  position: "sticky", top: 0, zIndex: 5,
                }}>
                  <span>Наименование</span>
                  <span>Ед.</span>
                  <span style={{ textAlign: "right" }}>Кол-во</span>
                  <span style={{ textAlign: "right" }}>Цена</span>
                  <span style={{ textAlign: "right" }}>Сумма</span>
                </div>

                {items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,2fr) 80px 70px 90px 90px",
                      padding: "9px 24px",
                      borderBottom: "1px solid var(--border-subtle)",
                      fontSize: 12.5, alignItems: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.item_name}</p>
                      {item.specification && (
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{item.specification}</p>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{item.unit ?? "—"}</span>
                    <span style={{ textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                      {item.qty !== undefined ? fmt(item.qty, 0) : "—"}
                    </span>
                    <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>
                      {item.unit_price_estimated ? fmt(item.unit_price_estimated) : "—"}
                    </span>
                    <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                      {item.amount_estimated ? fmt(item.amount_estimated) : "—"}
                    </span>
                  </div>
                ))}

                {/* Итого */}
                {req.total_estimated != null && req.total_estimated > 0 && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,2fr) 80px 70px 90px 90px",
                    padding: "10px 24px",
                    background: "rgba(255,255,255,0.03)",
                    fontSize: 13, fontWeight: 600,
                  }}>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", fontFamily: "monospace", letterSpacing: "0.05em" }}>ИТОГО</span>
                    <span /><span /><span />
                    <span style={{ textAlign: "right", fontFamily: "monospace", color: "var(--accent)" }}>
                      {fmt(req.total_estimated)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {items.length === 0 && (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                Позиций пока нет
              </div>
            )}

            {/* Оприходование на склад */}
            {preview && preview.existing_movements > 0 && (
              <div style={{ margin: "0 24px 12px", padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, fontSize: 12, color: "var(--success)" }}>
                ✓ По заявке создано {preview.existing_movements} движений склада
              </div>
            )}
            {preview && preview.can_receive && !showReceive && (
              <div style={{ padding: "0 24px 12px" }}>
                <button onClick={() => setShowReceive(true)} style={{
                  width: "100%", padding: "11px 0", borderRadius: 10, border: "1px solid var(--success)",
                  background: "rgba(34,197,94,0.1)", color: "var(--success)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}>📦 Оприходовать на склад ({preview.items.length} позиций)</button>
              </div>
            )}
            {showReceive && preview && (
              <div style={{ margin: "0 24px 12px", padding: "14px 16px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px", fontFamily: "monospace" }}>Оприходование</p>
                <div style={{ marginBottom: 10, fontSize: 11, color: "var(--text-tertiary)" }}>
                  Будет создано {preview.items.length} движений · новых карточек: {preview.items.filter(i => i.match_type === "Создаётся новый").length}
                </div>
                <div style={{ maxHeight: 150, overflowY: "auto", marginBottom: 10, padding: "6px 8px", background: "var(--bg-elevated)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                  {preview.items.map((it, i) => (
                    <div key={i} style={{ fontSize: 11, padding: "3px 0", display: "flex", justifyContent: "space-between" }}>
                      <span><b>{it.item_name}</b> {it.qty} {it.unit}</span>
                      <span style={{ color: it.match_type === "Создаётся новый" ? "var(--warning)" : "var(--success)" }}>{it.match_type}</span>
                    </div>
                  ))}
                </div>
                <input value={receiveForm.supplier_name} onChange={(e) => setReceiveForm({ ...receiveForm, supplier_name: e.target.value })} placeholder="Поставщик" style={miniInput} />
                <input value={receiveForm.invoice_number} onChange={(e) => setReceiveForm({ ...receiveForm, invoice_number: e.target.value })} placeholder="№ накладной" style={miniInput} />
                <input value={receiveForm.responsible} onChange={(e) => setReceiveForm({ ...receiveForm, responsible: e.target.value })} placeholder="Ответственный (ФИО)" style={miniInput} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => setShowReceive(false)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>Отмена</button>
                  <button onClick={handleReceive} disabled={receiving} style={{ flex: 2, padding: "8px", borderRadius: 8, border: "none", background: "var(--success)", color: "white", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: receiving ? 0.5 : 1 }}>{receiving ? "Оприходование..." : "✓ Подтвердить и оприходовать"}</button>
                </div>
              </div>
            )}

            {/* ERPNext */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
              <a
                href={`http://erp.olimp-ural.ru/app/material-request/${req.name}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "block", textAlign: "center", fontSize: 12.5, padding: "9px 0", borderRadius: 10, border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", textDecoration: "none" }}
              >
                Открыть в ERPNext
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function KpiCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ flex: 1, padding: "12px 20px", borderRight: "1px solid var(--border-subtle)" }}>
      <p style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 15, fontFamily: "monospace", fontWeight: 600, color: accent ?? "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
