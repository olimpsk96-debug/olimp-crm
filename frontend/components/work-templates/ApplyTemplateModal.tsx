"use client";

import { useEffect, useState } from "react";
import type { WorkTemplate } from "@/types/work-template";

interface EstimateOption {
  name: string;
  title?: string;
  status?: string;
}

interface ApplyResult {
  ok: true;
  added: number;
  total_base: number;
  total_our: number;
  margin_pct: number;
  volume: number;
  estimate: string;
  template: string;
}

export default function ApplyTemplateModal({
  template,
  onClose,
  onApplied,
}: {
  template: WorkTemplate;
  onClose: () => void;
  onApplied: (result: ApplyResult) => void;
}) {
  const [estimates, setEstimates] = useState<EstimateOption[]>([]);
  const [selectedEstimate, setSelectedEstimate] = useState("");
  const [volume, setVolume] = useState<number>(template.typical_volume_min || 100);
  const [markup, setMarkup] = useState<number>(15);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/estimates")
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : [];
        setEstimates(arr);
        if (arr.length > 0) setSelectedEstimate(arr[0].name);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function apply() {
    if (!selectedEstimate) { setError("Выбери смету"); return; }
    if (!volume || volume <= 0) { setError("Укажи объём"); return; }
    setApplying(true);
    setError(null);
    try {
      const r = await fetch("/api/work-templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_name: template.template_id,
          estimate_name: selectedEstimate,
          volume,
          markup_pct: markup,
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.error || `Ошибка ${r.status}`);
        return;
      }
      onApplied(d as ApplyResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 500, maxWidth: "100%", background: "var(--bg-base)",
        border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "22px 26px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>Применить шаблон в смету</h2>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
              Этапы шаблона добавятся как строки в смету
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 12, marginBottom: 14, background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{template.title}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
            {template.template_id} · {template.category} · базовая ед.: {template.base_unit}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
            Этапов: <b>{template.stages_count ?? "—"}</b> · типовой объём {template.typical_volume_min}–{template.typical_volume_max} {template.base_unit}
          </div>
        </div>

        <label style={lblStyle}>Смета *</label>
        {loading ? (
          <div style={{ padding: 14, color: "var(--text-tertiary)", fontSize: 12 }}>Загружаю список смет...</div>
        ) : estimates.length === 0 ? (
          <div style={{ padding: 12, background: "rgba(251,191,36,0.1)", border: "1px solid var(--warning)", borderRadius: 7, fontSize: 11.5, color: "var(--warning)", marginBottom: 12 }}>
            Смет нет. Сначала создай смету в /estimates.
          </div>
        ) : (
          <select value={selectedEstimate} onChange={(e) => setSelectedEstimate(e.target.value)}
                  style={{ ...inpStyle, marginBottom: 12 }}>
            {estimates.map((e) => (
              <option key={e.name} value={e.name}>
                {e.name}{e.title ? ` — ${e.title}` : ""}{e.status ? ` (${e.status})` : ""}
              </option>
            ))}
          </select>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={lblStyle}>Объём ({template.base_unit}) *</label>
            <input type="number" min={0} step={0.1} value={volume}
                   onChange={(e) => setVolume(parseFloat(e.target.value) || 0)}
                   style={inpStyle} />
          </div>
          <div>
            <label style={lblStyle}>Наценка, %</label>
            <input type="number" min={0} step={0.5} value={markup}
                   onChange={(e) => setMarkup(parseFloat(e.target.value) || 0)}
                   style={inpStyle} />
          </div>
        </div>

        {error && (
          <div style={{ padding: 10, marginBottom: 12, background: "rgba(248,113,113,0.1)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={btnCancel}>Отмена</button>
          <button onClick={apply} disabled={applying || !selectedEstimate}
                  style={{ ...btnPrimary, opacity: applying || !selectedEstimate ? 0.6 : 1 }}>
            {applying ? "Применяю..." : "✓ Применить в смету"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inpStyle: React.CSSProperties = {
  padding: "9px 12px", fontSize: 13, color: "var(--text-primary)",
  background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
  borderRadius: 8, outline: "none", width: "100%",
};
const lblStyle: React.CSSProperties = {
  display: "block", fontSize: 10.5, color: "var(--text-tertiary)",
  marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace",
};
const btnPrimary: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500,
  background: "var(--accent)", color: "white", border: "none", cursor: "pointer",
};
const btnCancel: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500,
  background: "var(--bg-elevated)", color: "var(--text-secondary)",
  border: "1px solid var(--border-subtle)", cursor: "pointer",
};
