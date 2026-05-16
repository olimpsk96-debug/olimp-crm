"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

const EstimateGrid = dynamic(
  () => import("@/components/estimate/EstimateGrid").then((m) => m.EstimateGrid),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка таблицы…</div> },
);

interface GridRow {
  name?: string;
  idx?: number;
  is_section: number;
  section_title: string;
  item_code: string;
  item_name: string;
  unit: string;
  qty: number;
  base_unit_price: number;
  base_amount: number;
  our_unit_price: number;
  our_amount: number;
  deviation_pct?: number;
  work_type: string;
  notes: string;
  [key: string]: unknown;
}

interface Totals {
  base_total: number;
  our_total: number;
  margin_amount: number;
  margin_pct: number;
}

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

export default function EstimateGridPage() {
  const params = useParams<{ name: string }>();
  const router = useRouter();
  const toast = useToast();
  const name = decodeURIComponent(params.name);

  const [rows, setRows] = useState<GridRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"works" | "measurements" | "resources">("works");

  function reload() {
    setLoading(true);
    fetch(`/api/estimates/${encodeURIComponent(name)}/grid`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        setRows(d.rows || []);
        setTotals(d.totals || null);
        setTitle(d.title || name);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/estimates/${encodeURIComponent(name)}/grid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_batch", rows }),
      });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(`Сохранено ${d.items_count} позиций`);
      setTotals(d.totals);
      setDirty(false);
    } finally { setSaving(false); }
  }, [rows, name, toast]);

  useEffect(() => {
    function h(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [save]);

  async function applyMarkup() {
    const input = window.prompt("Применить наценку % ко всем позициям:", "15");
    if (!input) return;
    const pct = parseFloat(input);
    if (isNaN(pct)) { toast.error("Введите число"); return; }
    if (dirty) {
      if (!window.confirm("Сначала сохранить изменения?")) return;
      await save();
    }
    const r = await fetch(`/api/estimates/${encodeURIComponent(name)}/grid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply_markup", markup_pct: pct }),
    });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success(`Применено ${pct}% ко всем позициям`); reload(); }
  }

  async function createProposal() {
    if (dirty) {
      if (!window.confirm("Сначала сохранить изменения сметы?")) return;
      await save();
    }
    if (!window.confirm("Создать Коммерческое Предложение на базе сметы?")) return;
    const r = await fetch(`/api/estimates/${encodeURIComponent(name)}/grid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_proposal" }),
    });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else {
      toast.success(`Создано КП ${d.proposal_name}`);
      router.push(`/proposals/${encodeURIComponent(d.proposal_name)}`);
    }
  }

  return (
    <div style={{ padding: "20px 24px 40px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ marginBottom: 14 }}>
        <Link href="/estimates" style={{
          fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none",
          marginBottom: 8, display: "inline-block",
        }}>← К сметам</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{title}</h1>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
              {name} · Excel-like редактор · F2 — править, Enter — следующая строка, Ctrl+C/V — копировать
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={save} disabled={saving} style={{
              padding: "9px 16px", fontSize: 13, fontWeight: 500,
              background: dirty ? "var(--accent)" : "var(--bg-elevated)",
              color: dirty ? "white" : "var(--text-secondary)",
              border: `1px solid ${dirty ? "var(--accent)" : "var(--border-subtle)"}`,
              borderRadius: 7, cursor: "pointer", opacity: saving ? 0.6 : 1,
            }}>
              {saving ? "..." : dirty ? "💾 Сохранить" : "✓ Сохранено"}
            </button>
            <button onClick={applyMarkup} style={btnSecondary}>📈 Наценка ко всем</button>
            <button onClick={createProposal} style={{
              ...btnSecondary, borderColor: "#7c3aed", color: "#7c3aed",
            }}>📋 Создать КП</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "1px solid var(--border-subtle)" }}>
        {[
          { id: "works", label: "Работы" },
          { id: "measurements", label: "Обмеры" },
          { id: "resources", label: "Ресурсы" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as "works" | "measurements" | "resources")}
                  style={{
                    padding: "9px 14px", fontSize: 13, fontWeight: 500,
                    background: "transparent",
                    color: tab === t.id ? "var(--text-primary)" : "var(--text-tertiary)",
                    border: "none", borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
                    cursor: "pointer",
                  }}>{t.label}</button>
        ))}
      </div>

      {/* KPI totals */}
      {totals && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
          {[
            { label: "База", value: fmtMoney(totals.base_total), color: "var(--text-secondary)" },
            { label: "Наша цена", value: fmtMoney(totals.our_total), color: "var(--text-primary)" },
            { label: "Маржа ₽", value: fmtMoney(totals.margin_amount),
              color: totals.margin_amount > 0 ? "var(--success)" : "var(--danger)" },
            { label: "Маржа %", value: `${totals.margin_pct.toFixed(1)}%`,
              color: totals.margin_pct >= 15 ? "var(--success)" : totals.margin_pct >= 5 ? "#eab308" : "var(--danger)" },
          ].map((k) => (
            <div key={k.label} style={{
              padding: "10px 14px", borderRadius: 8,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка…</div>
      ) : tab === "works" ? (
        <EstimateGrid rows={rows} onChange={(next: GridRow[]) => { setRows(next); setDirty(true); }} />
      ) : tab === "measurements" ? (
        <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
          📐 Обмерный лист — в разработке (v6.2.1).<br/>
          <div style={{ fontSize: 11, marginTop: 6 }}>Здесь будет: длина × ширина × количество = объём, авто-вставка в позиции работ.</div>
        </div>
      ) : (
        <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
          📦 Ресурсный план — в разработке (v6.2.2).<br/>
          <div style={{ fontSize: 11, marginTop: 6 }}>Здесь будет: материалы/трудозатраты/механизмы из CWICR с авто-расчётом.</div>
        </div>
      )}
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  padding: "9px 14px", fontSize: 13, fontWeight: 500,
  background: "var(--bg-elevated)", color: "var(--text-secondary)",
  border: "1px solid var(--border-subtle)", borderRadius: 7, cursor: "pointer",
};
