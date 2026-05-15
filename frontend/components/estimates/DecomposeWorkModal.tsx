"use client";

import { useState } from "react";

interface DecompStage {
  title: string;
  unit: string;
  qty: number;
  labor_hours: number;
  materials: Record<string, number>;
  gesn_ref: string;
  notes?: string;
}

interface DecompResult {
  ok: true;
  source: "template" | "ai";
  template_name?: string;
  template_match_score?: number;
  decomposition: {
    title: string;
    category: string;
    base_unit: string;
    volume: number;
    stages: DecompStage[];
    warnings?: string;
  };
  estimate_items_added?: number;
}

/**
 * Модалка AI-декомпозиции работы.
 * Сценарий:
 *  1) Дима пишет "усиление плиты углеволокном 120 м²"
 *  2) Жмёт "Разложить" → API ищет шаблон / спрашивает Claude
 *  3) Показываем этапы для предпросмотра
 *  4) Жмёт "Добавить в смету" → строки появляются в Estimate
 */
export default function DecomposeWorkModal({
  estimateName,
  onClose,
  onApplied,
}: {
  estimateName: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [description, setDescription] = useState("");
  const [volume, setVolume] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecompResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (description.trim().length < 5) {
      setError("Опиши работу хотя бы парой слов (например: «усиление плиты углеволокном 120 м²»)");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/estimates/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          volume: typeof volume === "number" ? volume : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.error || `Ошибка ${r.status}`);
      } else {
        setResult(d as DecompResult);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function applyToEstimate() {
    if (!result) return;
    setApplying(true);
    setError(null);
    try {
      const r = await fetch("/api/estimates/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          volume: typeof volume === "number" ? volume : undefined,
          estimate_name: estimateName,
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.error || `Ошибка ${r.status}`);
        return;
      }
      onApplied();
    } catch (e) {
      setError(String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div onClick={onClose}
         style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
           style={{ width: 720, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "22px 24px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>
              🪄 AI-декомпозиция работы
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, margin: "4px 0 0 0" }}>
              Опиши работу в произвольной форме — система разложит на этапы с объёмами
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Поле ввода */}
        <label style={lbl}>Описание работы</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="усиление плиты углеволокном 120 м² / АКЗ резервуара РВС-2000 1800 м² / огнезащита м/к R90 350 м²"
          rows={2}
          style={{ ...inputStyle, marginBottom: 10, fontFamily: "inherit", resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Объём (необязательно, если в описании есть)</label>
            <input
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value ? parseFloat(e.target.value) : "")}
              placeholder="например, 120"
              style={inputStyle}
            />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button onClick={generate} disabled={loading}
                    style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, padding: "9px 18px", whiteSpace: "nowrap" }}>
              {loading ? "Разбираю..." : "🪄 Разложить"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: 10, marginBottom: 12, background: "rgba(248,113,113,0.1)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Превью результата */}
        {result && (
          <>
            <div style={{ padding: 12, marginBottom: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{result.decomposition.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {result.decomposition.category} · {result.decomposition.volume} {result.decomposition.base_unit}
                  </div>
                </div>
                <div style={{
                  padding: "3px 9px", fontSize: 10, fontFamily: "monospace",
                  borderRadius: 5,
                  background: result.source === "template" ? "rgba(34,197,94,0.15)" : "rgba(168,139,250,0.15)",
                  color: result.source === "template" ? "var(--success)" : "#a78bfa",
                }}>
                  {result.source === "template" ? "📋 ШАБЛОН" : "🤖 AI"}
                </div>
              </div>
              {result.decomposition.warnings && (
                <div style={{ fontSize: 11.5, color: "var(--warning)", marginTop: 6 }}>
                  ⚠️ {result.decomposition.warnings}
                </div>
              )}
            </div>

            <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 70px 90px 110px 90px", gap: 0, padding: "8px 12px", background: "var(--bg-elevated)", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                <div>№</div><div>Этап</div><div>Ед.</div><div>Кол-во</div><div>Материалы</div><div>Час·чел</div>
              </div>
              {result.decomposition.stages.map((s, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "30px 1fr 70px 90px 110px 90px",
                  gap: 0, padding: "8px 12px",
                  borderTop: "1px solid var(--border-subtle)",
                  fontSize: 12,
                  alignItems: "center",
                }}>
                  <div style={{ color: "var(--text-tertiary)", fontFamily: "monospace" }}>{i + 1}</div>
                  <div>
                    {s.title}
                    {s.gesn_ref && <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: 6, fontFamily: "monospace" }}>{s.gesn_ref}</span>}
                    {s.notes && <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2 }}>{s.notes}</div>}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>{s.unit}</div>
                  <div style={{ fontFamily: "monospace" }}>{s.qty.toLocaleString("ru-RU")}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>
                    {Object.entries(s.materials).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
                  </div>
                  <div style={{ fontFamily: "monospace", color: "var(--accent)" }}>{s.labor_hours.toFixed(1)}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {result.decomposition.stages.length} этапов · итого {result.decomposition.stages.reduce((acc, s) => acc + s.labor_hours, 0).toFixed(1)} чел.-час
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onClose} style={btnCancel}>Отмена</button>
                <button onClick={applyToEstimate} disabled={applying}
                        style={{ ...btnPrimary, opacity: applying ? 0.6 : 1 }}>
                  {applying ? "Добавляю..." : `✓ Добавить в смету (${result.decomposition.stages.length})`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", fontSize: 13, color: "var(--text-primary)",
  background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8,
  outline: "none", width: "100%",
};

const lbl: React.CSSProperties = {
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
