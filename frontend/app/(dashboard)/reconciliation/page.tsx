"use client";

import { useEffect, useState } from "react";

interface Partner {
  party: string;
  party_name: string;
  ks2_count: number;
  total_amount: number;
  last_act: string | null;
}

interface ReconRow {
  date: string;
  doc_type: string;
  doc_number: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface ReconResponse {
  party: string;
  party_name: string;
  party_type: string;
  from_date: string;
  to_date: string;
  opening_balance: number;
  rows: ReconRow[];
  totals: { debit: number; credit: number; closing_balance: number };
  as_of: string;
}

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v);
}

function today(): string { return new Date().toISOString().substring(0, 10); }
function ago(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().substring(0, 10);
}

export default function ReconciliationPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partner, setPartner] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(ago(180));
  const [toDate, setToDate] = useState<string>(today());
  const [recon, setRecon] = useState<ReconResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/reconciliation?mode=partners&party_type=Customer&days=730")
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : [];
        setPartners(arr);
        if (arr.length > 0 && !partner) setPartner(arr[0].party);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function build() {
    if (!partner) return;
    setLoading(true);
    const p = new URLSearchParams({
      party_type: "Customer", party: partner, from_date: fromDate, to_date: toDate,
    });
    fetch(`/api/reconciliation?${p}`)
      .then((r) => r.json())
      .then((d) => setRecon(d && !d.error ? d : null))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (partner) build(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [partner, fromDate, toDate]);

  function downloadXlsx() {
    if (!partner) return;
    const p = new URLSearchParams({
      mode: "export", party_type: "Customer", party: partner, from_date: fromDate, to_date: toDate,
    });
    window.location.href = `/api/reconciliation?${p}`;
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Акт сверки расчётов</h1>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
          Сверка с заказчиком по подписанным КС-2 и оплатам · 1С/СБИС-формат
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16,
        padding: 12, background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)", borderRadius: 10,
      }}>
        <div>
          <label style={lblStyle}>Контрагент</label>
          <select value={partner} onChange={(e) => setPartner(e.target.value)} style={{ ...inpStyle, minWidth: 280 }}>
            <option value="">— выберите —</option>
            {partners.map((p) => (
              <option key={p.party} value={p.party}>
                {p.party_name} ({p.ks2_count} КС-2, {Math.round(p.total_amount / 1000)}K₽)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lblStyle}>С даты</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inpStyle} />
        </div>
        <div>
          <label style={lblStyle}>По дату</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inpStyle} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end", gap: 8 }}>
          <button onClick={downloadXlsx} disabled={!partner}
                  style={{
                    padding: "10px 18px", fontSize: 13, fontWeight: 500,
                    background: "var(--success)", color: "white",
                    border: "none", borderRadius: 8, cursor: "pointer",
                    opacity: partner ? 1 : 0.5,
                  }}>
            ⬇ Скачать .xlsx
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && !recon && partner && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
          Нет данных за период
        </div>
      )}

      {recon && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            <KPI label="Сальдо на начало" value={recon.opening_balance} accent />
            <KPI label="Дебет (выполнили)" value={recon.totals.debit} positive />
            <KPI label="Кредит (оплачено)" value={recon.totals.credit} negative />
            <KPI label="Сальдо на конец" value={recon.totals.closing_balance} accent strong />
          </div>

          {/* Conclusion */}
          <div style={{
            padding: 14, marginBottom: 14, borderRadius: 10,
            background: Math.abs(recon.totals.closing_balance) < 0.01 ? "rgba(74,222,128,0.10)"
                       : recon.totals.closing_balance > 0 ? "rgba(248,113,113,0.10)"
                       : "rgba(234,179,8,0.10)",
            border: `1px solid ${Math.abs(recon.totals.closing_balance) < 0.01 ? "var(--success)" : "var(--danger)"}`,
            fontSize: 13, fontWeight: 500,
          }}>
            {Math.abs(recon.totals.closing_balance) < 0.01
              ? `✓ Расчёты закрыты, задолженности нет`
              : recon.totals.closing_balance > 0
                ? `💰 Задолженность «${recon.party_name}» перед нами: ${fmtMoney(recon.totals.closing_balance)} ₽`
                : `⚠ Наша задолженность перед «${recon.party_name}»: ${fmtMoney(-recon.totals.closing_balance)} ₽`}
          </div>

          {/* Table */}
          <div style={{
            background: "var(--bg-elevated)", borderRadius: 10,
            border: "1px solid var(--border-subtle)", overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={thStyle}>Дата</th>
                  <th style={thStyle}>Тип</th>
                  <th style={thStyle}>№ документа</th>
                  <th style={thStyle}>Содержание</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Дебет, ₽</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Кредит, ₽</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Сальдо, ₽</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <td colSpan={6} style={{ ...tdStyle, fontStyle: "italic", color: "var(--text-tertiary)" }}>
                    Сальдо на начало периода
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                    {fmtMoney(recon.opening_balance)}
                  </td>
                </tr>
                {recon.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={tdStyle}>{row.date}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "1px 7px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: row.doc_type === "Оплата" ? "rgba(74,222,128,0.15)" : "rgba(96,165,250,0.15)",
                        color: row.doc_type === "Оплата" ? "var(--success)" : "#3b82f6",
                      }}>
                        {row.doc_type}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11.5 }}>{row.doc_number}</td>
                    <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{row.description}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", color: row.debit ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                      {row.debit ? fmtMoney(row.debit) : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", color: row.credit ? "var(--success)" : "var(--text-tertiary)" }}>
                      {row.credit ? fmtMoney(row.credit) : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                      {fmtMoney(row.balance)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "var(--bg-base)", borderTop: "2px solid var(--border-subtle)" }}>
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 600 }}>ИТОГО за период</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                    {fmtMoney(recon.totals.debit)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "var(--success)" }}>
                    {fmtMoney(recon.totals.credit)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                    {fmtMoney(recon.totals.closing_balance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, accent, positive, negative, strong }: {
  label: string; value: number; accent?: boolean; positive?: boolean; negative?: boolean; strong?: boolean;
}) {
  const color = negative ? "var(--success)" : positive ? "#3b82f6" : accent ? "var(--text-primary)" : "var(--text-secondary)";
  return (
    <div style={{
      padding: 14, borderRadius: 10,
      background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
    }}>
      <div style={{ fontSize: 20, fontWeight: strong ? 700 : 600, color, fontFamily: "monospace" }}>
        {fmtMoney(value)} ₽
      </div>
      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
    </div>
  );
}

const inpStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 13,
  background: "var(--bg-base)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 7,
  outline: "none",
};

const lblStyle: React.CSSProperties = {
  display: "block", fontSize: 10.5, color: "var(--text-tertiary)",
  textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4,
};

const thStyle: React.CSSProperties = {
  padding: "9px 10px", textAlign: "left", fontSize: 11, fontWeight: 500,
  color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em",
};

const tdStyle: React.CSSProperties = {
  padding: "9px 10px", color: "var(--text-primary)",
};
