"use client";

import { useEffect, useState, useRef } from "react";
import type { Estimate, EstimateItem, EstimateStatus } from "@/types/estimate";

interface Props {
  name: string | null;
  onClose: () => void;
  onUpdated?: (est: Estimate) => void;
}

const STATUS_OPTIONS: EstimateStatus[] = ["Базовая", "Скорректированная", "Утверждена", "Архив"];

const STATUS_COLOR: Record<string, string> = {
  "Базовая":           "var(--info)",
  "Скорректированная": "var(--warning)",
  "Утверждена":        "var(--success)",
  "Архив":             "var(--text-tertiary)",
};

function fmt(v?: number | null, digits = 2) {
  if (!v && v !== 0) return "—";
  return v.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtMln(v?: number | null) {
  if (!v) return "—";
  return `${(v / 1_000_000).toFixed(2)} млн ₽`;
}

function DeviationBadge({ pct }: { pct?: number | null }) {
  if (pct === undefined || pct === null || pct === 0) return null;
  const pos = pct > 0;
  return (
    <span style={{
      fontSize: 10, fontFamily: "monospace", fontWeight: 600,
      padding: "1px 5px", borderRadius: 4, marginLeft: 6,
      background: pos ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
      color: pos ? "var(--success)" : "var(--danger)",
    }}>
      {pos ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

export function EstimateDrawer({ name, onClose, onUpdated }: Props) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!name) { setEstimate(null); return; }
    setLoading(true);
    fetch(`/api/estimates/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data) => {
        setEstimate(data);
        // Раскрыть все секции по умолчанию
        const sections = new Set<number>();
        (data.items ?? []).forEach((_: EstimateItem, idx: number) => sections.add(idx));
        setExpandedSections(sections);
      })
      .finally(() => setLoading(false));
  }, [name]);

  async function handleStatusChange(newStatus: EstimateStatus) {
    if (!estimate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/estimates/${encodeURIComponent(estimate.name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.updated) {
        const updated = { ...estimate, status: newStatus };
        setEstimate(updated);
        onUpdated?.(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleImportXml(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !estimate) return;
    setImporting(true);
    try {
      // Гранд-Смета пишет XML в windows-1251. Определяем кодировку из declaration.
      const buf = await file.arrayBuffer();
      const probe = new TextDecoder("ascii").decode(buf.slice(0, 200));
      const encMatch = probe.match(/encoding\s*=\s*"([^"]+)"/i);
      const enc = (encMatch?.[1] || "utf-8").toLowerCase();
      const decoder =
        enc.includes("1251") || enc.includes("cp1251") || enc.includes("cyrillic")
          ? new TextDecoder("windows-1251")
          : new TextDecoder(enc.includes("utf") ? "utf-8" : enc);
      const text = decoder.decode(buf);
      const res = await fetch("/api/estimates/import-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml_content: text, estimate_name: estimate.name }),
      });
      const data = await res.json();
      if (data.items_count) {
        const targetName = data.updated ?? data.created ?? estimate.name;
        const refreshed = await fetch(`/api/estimates/${encodeURIComponent(targetName)}`).then((r) => r.json());
        setEstimate(refreshed);
        onUpdated?.(refreshed);
      }
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const isOpen = !!name;
  const items = estimate?.items ?? [];

  // Разбиваем на секции для отображения
  const sections: { title: string; idx: number; rows: (EstimateItem & { globalIdx: number })[] }[] = [];
  let currentSection = { title: "Без раздела", idx: -1, rows: [] as (EstimateItem & { globalIdx: number })[] };

  items.forEach((item, idx) => {
    if (item.is_section) {
      if (currentSection.rows.length > 0 || currentSection.idx === -1) {
        if (currentSection.idx !== -1) sections.push(currentSection);
      }
      currentSection = { title: item.item_name, idx, rows: [] };
    } else {
      currentSection.rows.push({ ...item, globalIdx: idx });
    }
  });
  if (currentSection.rows.length > 0) sections.push(currentSection);

  return (
    <>
      {/* Backdrop */}
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

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 680, zIndex: 50,
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
                <div style={{ height: 20, borderRadius: 6, background: "var(--border-subtle)", width: "60%" }} />
              ) : (
                <h2 style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, letterSpacing: "-0.01em" }}>
                  {estimate?.title ?? "—"}
                </h2>
              )}
              {estimate && (
                <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "monospace" }}>
                  {estimate.name} {estimate.version ? `· v${estimate.version}` : ""}
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

          {/* Статус + actions */}
          {estimate && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Статус:</span>
              <select
                value={estimate.status}
                disabled={saving}
                onChange={(e) => handleStatusChange(e.target.value as EstimateStatus)}
                style={{
                  fontSize: 12, padding: "3px 8px", borderRadius: 7,
                  border: `1px solid ${STATUS_COLOR[estimate.status] ?? "var(--border-subtle)"}`,
                  background: "transparent",
                  color: STATUS_COLOR[estimate.status] ?? "var(--text-primary)",
                  cursor: "pointer", outline: "none",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>
                ))}
              </select>

              <input ref={fileRef} type="file" accept=".xml,.gs3" style={{ display: "none" }} onChange={handleImportXml} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 7, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", cursor: importing ? "wait" : "pointer", opacity: importing ? 0.5 : 1 }}
              >
                {importing ? "Импорт..." : "Импорт XML"}
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 13 }}>Загрузка...</div>
        )}

        {estimate && !loading && (
          <>
            {/* KPI полоса */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
              <KpiCell label="Сумма норм." value={fmtMln(estimate.base_total)} />
              <KpiCell label="Наша цена" value={fmtMln(estimate.our_total)} accent="var(--accent)" />
              <KpiCell
                label="Маржа"
                value={estimate.margin_pct !== undefined && estimate.margin_pct !== null ? `${estimate.margin_pct.toFixed(1)}%` : "—"}
                accent={estimate.margin_pct !== null && estimate.margin_pct !== undefined
                  ? estimate.margin_pct >= 20 ? "var(--success)" : estimate.margin_pct >= 10 ? "var(--warning)" : "var(--danger)"
                  : undefined}
              />
              {estimate.project && <KpiCell label="Проект" value={estimate.project} />}
              {estimate.tender && <KpiCell label="Тендер" value={estimate.tender} />}
            </div>

            {/* Позиции сметы */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {sections.length === 0 && (
                <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                  Позиций пока нет. Добавьте вручную или импортируйте XML из Гранд-Сметы.
                </div>
              )}

              {/* Заголовок таблицы */}
              {sections.length > 0 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "60px minmax(0,1fr) 50px 90px 90px 80px",
                  padding: "9px 20px",
                  fontSize: 10, fontFamily: "monospace",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  color: "var(--text-tertiary)",
                  background: "var(--bg-base)",
                  borderBottom: "1px solid var(--border-subtle)",
                  position: "sticky", top: 0, zIndex: 5,
                }}>
                  <span>Код</span>
                  <span>Наименование</span>
                  <span style={{ textAlign: "right" }}>Ед.</span>
                  <span style={{ textAlign: "right" }}>Кол-во</span>
                  <span style={{ textAlign: "right" }}>Ед. цена</span>
                  <span style={{ textAlign: "right" }}>Сумма</span>
                </div>
              )}

              {sections.map((sec, sIdx) => {
                const isExpanded = expandedSections.has(sIdx);
                const secTotal = sec.rows.reduce((s, r) => s + (r.our_amount ?? r.base_amount ?? 0), 0);
                return (
                  <div key={sIdx}>
                    {/* Заголовок раздела */}
                    <div
                      onClick={() => setExpandedSections((prev) => {
                        const next = new Set(prev);
                        if (next.has(sIdx)) next.delete(sIdx); else next.add(sIdx);
                        return next;
                      })}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "11px 20px",
                        background: "rgba(255,255,255,0.03)",
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <svg
                          width="12" height="12" viewBox="0 0 16 16" fill="none"
                          stroke="var(--text-tertiary)" strokeWidth="2"
                          style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0 }}
                        >
                          <path d="M6 3l5 5-5 5" />
                        </svg>
                        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{sec.title}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>· {sec.rows.length} поз.</span>
                      </div>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>
                        {secTotal > 0 ? `${(secTotal / 1000).toFixed(1)} тыс. ₽` : ""}
                      </span>
                    </div>

                    {/* Строки позиций */}
                    {isExpanded && sec.rows.map((row, rIdx) => (
                      <div
                        key={rIdx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "60px minmax(0,1fr) 50px 90px 90px 80px",
                          padding: "9px 20px",
                          borderBottom: "1px solid var(--border-subtle)",
                          fontSize: 12.5,
                          alignItems: "center",
                          transition: "background 0.1s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)" }}>
                          {row.item_code ?? ""}
                        </span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>
                          {row.item_name}
                          <DeviationBadge pct={row.deviation_pct} />
                        </span>
                        <span style={{ textAlign: "right", color: "var(--text-tertiary)", fontSize: 11 }}>
                          {row.unit ?? ""}
                        </span>
                        <span style={{ textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                          {row.qty !== undefined ? fmt(row.qty, 0) : "—"}
                        </span>
                        <span style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {fmt(row.our_unit_price ?? row.base_unit_price)}
                        </span>
                        <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                          {fmt(row.our_amount ?? row.base_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Экспорт + ссылка ERPNext */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <a href={`/api/estimates/export?name=${encodeURIComponent(estimate.name)}&format=pdf`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", fontSize: 12.5, padding: "9px 0", borderRadius: 10, border: "1px solid var(--accent)", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
                Скачать PDF
              </a>
              <a href={`/api/estimates/export?name=${encodeURIComponent(estimate.name)}&format=xlsx`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", fontSize: 12.5, padding: "9px 0", borderRadius: 10, border: "1px solid var(--success)", color: "var(--success)", textDecoration: "none", fontWeight: 500 }}>
                Скачать Excel
              </a>
              <a
                href={`http://erp.olimp-ural.ru/app/estimate/${estimate.name}`}
                target="_blank" rel="noopener noreferrer"
                style={{ gridColumn: "1 / span 2", display: "block", textAlign: "center", fontSize: 12.5, padding: "9px 0", borderRadius: 10, border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", textDecoration: "none" }}
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
