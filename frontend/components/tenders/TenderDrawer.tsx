"use client";

import { useEffect, useState } from "react";
import type { Tender, TenderStatus } from "@/types/tender";
import { EntityTimeline } from "@/components/ui/EntityTimeline";

interface Props {
  name: string | null;
  onClose: () => void;
  onStatusChange?: (name: string, status: TenderStatus) => void;
}

const STATUS_OPTIONS: TenderStatus[] = [
  "Новый", "Оценивается", "Готовится заявка",
  "Заявка подана", "Выиграли", "Проиграли", "Отклонён",
];

const STATUS_COLOR: Record<string, string> = {
  "Новый":             "var(--info)",
  "Оценивается":       "var(--warning)",
  "Готовится заявка":  "var(--accent)",
  "Заявка подана":     "#C084FC",
  "Выиграли":          "var(--success)",
  "Проиграли":         "var(--danger)",
  "Отклонён":          "var(--text-tertiary)",
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

function formatMln(v?: number | null) {
  if (!v) return null;
  return `${(v / 1_000_000).toFixed(2)} млн ₽`;
}

type BoqPreview = {
  title: string;
  summary: string;
  sections: { section_code: string; section_name: string }[];
  positions: {
    section_code: string; position_code: string; description: string;
    unit: string; quantity: number; unit_rate: number;
    assembly_code: string | null; resource_type: string;
  }[];
  direct_cost: number;
  matched_assemblies: number;
  total_positions: number;
  ai_model?: string;
  tokens_used?: { input: number; output: number };
};

function AiBoqBlock({ tender }: { tender: Tender }) {
  const defaultDesc = [
    tender.title,
    tender.work_type ? `Вид работ: ${tender.work_type}` : "",
    tender.region ? `Регион: ${tender.region}` : "",
    tender.notes || "",
  ].filter(Boolean).join("\n");

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(defaultDesc);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<BoqPreview | null>(null);
  const [savedBoqName, setSavedBoqName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (description.trim().length < 20) {
      setError("Описание должно быть длиннее 20 символов");
      return;
    }
    setGenerating(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/boqs/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          description,
          customer: tender.customer || undefined,
          region: tender.region || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || `HTTP ${res.status}`); return; }
      setPreview(data);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/boqs/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          title: preview.title,
          summary: preview.summary,
          sections: preview.sections,
          positions: preview.positions,
          customer: tender.customer || undefined,
          project: tender.project_link || undefined,
          tender: tender.name,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || `HTTP ${res.status}`); return; }
      setSavedBoqName(data.name);
    } catch {
      setError("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "#C084FC", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace" }}>🤖 AI-смета (BOQ)</span>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 7, border: "1px solid rgba(168,85,247,0.4)", background: "transparent", color: "#C084FC", cursor: "pointer" }}
          >
            Сгенерировать смету
          </button>
        )}
      </div>

      {!open && (
        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          Claude разложит работы по разделам и подберёт расценки. ~30 сек.
        </p>
      )}

      {open && !savedBoqName && (
        <>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={generating || saving}
            rows={4}
            placeholder="Опишите работы: например «Огнезащита 350 м² R90, состав СГК-1»"
            style={{
              width: "100%", padding: 10, fontSize: 12.5, fontFamily: "inherit",
              borderRadius: 8, border: "1px solid var(--border-subtle)",
              background: "var(--bg-base)", color: "var(--text-primary)",
              outline: "none", resize: "vertical", lineHeight: 1.5,
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={generate}
              disabled={generating || saving || description.trim().length < 20}
              style={{
                flex: 1, fontSize: 12, padding: "7px 12px", borderRadius: 8,
                border: "none", background: "#A855F7", color: "white",
                cursor: generating ? "wait" : "pointer",
                opacity: generating || description.trim().length < 20 ? 0.5 : 1,
              }}
            >
              {generating ? "Генерирую (~30 сек)..." : preview ? "🔄 Перегенерировать" : "🤖 Сгенерировать"}
            </button>
          </div>
        </>
      )}

      {preview && !savedBoqName && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, lineHeight: 1.35 }}>{preview.title}</p>
          {preview.summary && (
            <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 8 }}>{preview.summary}</p>
          )}
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-tertiary)", marginBottom: 10 }}>
            <span>📂 {preview.sections.length} разделов</span>
            <span>📋 {preview.total_positions} позиций</span>
            <span>🔗 {preview.matched_assemblies} сборок</span>
          </div>
          <p style={{ fontSize: 16, fontWeight: 500, fontFamily: "monospace", color: "var(--success)" }}>
            {(preview.direct_cost / 1_000_000).toFixed(2)} млн ₽ <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 400 }}>прямых затрат</span>
          </p>
          <button
            onClick={save}
            disabled={saving}
            style={{
              width: "100%", marginTop: 10, fontSize: 12, padding: "8px 12px", borderRadius: 8,
              border: "none", background: "var(--success)", color: "white",
              cursor: saving ? "wait" : "pointer", opacity: saving ? 0.5 : 1, fontWeight: 500,
            }}
          >
            {saving ? "Сохраняю..." : "✓ Сохранить как BOQ"}
          </button>
        </div>
      )}

      {savedBoqName && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)" }}>
          <p style={{ fontSize: 12.5, color: "var(--success)", marginBottom: 6 }}>
            ✓ BOQ создан: <span style={{ fontFamily: "monospace" }}>{savedBoqName}</span>
          </p>
          <a
            href={`/boqs`}
            style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
          >
            Открыть список BOQ →
          </a>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}

function AiBlock({ tender, onScored }: { tender: Tender; onScored: (score: number, rec: string, analysis: string) => void }) {
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runScore() {
    setScoring(true);
    setError(null);
    try {
      const res = await fetch("/api/tenders/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tender_name: tender.name }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      onScored(data.score, data.recommendation, data.analysis ?? "");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setScoring(false);
    }
  }

  const aiScore = tender.ai_match_score;
  const color = aiScore === undefined || aiScore === null ? "var(--text-tertiary)"
    : aiScore >= 75 ? "var(--success)"
    : aiScore >= 50 ? "var(--warning)"
    : "var(--danger)";

  return (
    <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace" }}>AI-оценка</span>
        <button
          onClick={runScore}
          disabled={scoring}
          style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 7,
            border: "1px solid var(--border-subtle)",
            background: "transparent", color: "var(--text-secondary)",
            cursor: scoring ? "wait" : "pointer", opacity: scoring ? 0.5 : 1,
          }}
        >
          {scoring ? "Оцениваю..." : tender.ai_match_score !== undefined ? "Переоценить" : "Оценить"}
        </button>
      </div>

      {aiScore !== undefined && aiScore !== null && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 300, fontFamily: "monospace", color }}>{aiScore}%</span>
          <span style={{ fontSize: 13, color }}>{tender.ai_recommendation}</span>
        </div>
      )}

      {tender.ai_analysis && (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, marginTop: 6 }}>
          {tender.ai_analysis}
        </p>
      )}

      {error && (
        <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 8 }}>{error}</p>
      )}

      {!aiScore && !scoring && !error && (
        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Нажмите «Оценить» чтобы получить рекомендацию</p>
      )}
    </div>
  );
}

export function TenderDrawer({ name, onClose, onStatusChange }: Props) {
  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    if (!name) { setTender(null); return; }
    setLoading(true);
    fetch(`/api/tenders/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then(setTender)
      .finally(() => setLoading(false));
  }, [name]);

  async function handleStatusChange(newStatus: TenderStatus) {
    if (!tender) return;
    setSavingStatus(true);
    try {
      await fetch(`/api/tenders/${encodeURIComponent(tender.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setTender((t) => t ? { ...t, status: newStatus } : t);
      onStatusChange?.(tender.name, newStatus);
    } finally {
      setSavingStatus(false);
    }
  }

  const isOpen = !!name;

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
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 440, zIndex: 50,
          background: "var(--bg-elevated)",
          borderLeft: "1px solid var(--border-subtle)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Шапка */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ height: 20, borderRadius: 6, background: "var(--border-subtle)", width: "70%" }} />
              ) : (
                <h2 style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, letterSpacing: "-0.01em" }}>
                  {tender?.title ?? "—"}
                </h2>
              )}
              {tender && (
                <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "monospace" }}>
                  {tender.name}
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

          {/* Статус */}
          {tender && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Статус:</span>
              <select
                value={tender.status}
                disabled={savingStatus}
                onChange={(e) => handleStatusChange(e.target.value as TenderStatus)}
                style={{
                  fontSize: 12, padding: "3px 8px", borderRadius: 7,
                  border: `1px solid ${STATUS_COLOR[tender.status] ?? "var(--border-subtle)"}`,
                  background: "transparent",
                  color: STATUS_COLOR[tender.status] ?? "var(--text-primary)",
                  cursor: "pointer", outline: "none",
                  opacity: savingStatus ? 0.5 : 1,
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Тело */}
        {loading && (
          <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 13 }}>Загрузка...</div>
        )}

        {tender && !loading && (
          <div style={{ padding: "16px 24px 32px", flex: 1 }}>
            {/* Финансы */}
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 8 }}>Финансы</p>
            <Row label="НМЦК" value={formatMln(tender.nmck)} />
            <Row label="Наша цена" value={formatMln(tender.our_price)} />
            <Row label="Маржа" value={tender.margin_pct !== undefined && tender.margin_pct !== null ? `${tender.margin_pct}%` : null} />

            {/* Параметры */}
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 8, marginTop: 20 }}>Параметры</p>
            <Row label="Закон" value={tender.tender_law} />
            <Row label="Вид работ" value={tender.work_type} />
            <Row label="Регион" value={tender.region} />
            <Row label="Заказчик" value={tender.customer} />
            <Row label="№ закупки" value={tender.purchase_number} />

            {/* Сроки */}
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 8, marginTop: 20 }}>Сроки</p>
            <Row label="Дедлайн" value={tender.deadline_date ? `${tender.deadline_date}${tender.deadline_time ? " " + String(tender.deadline_time).slice(0, 5) + " МСК" : ""}` : null} />
            <Row label="Дата подачи" value={tender.submission_date} />

            {/* Ссылки */}
            {tender.platform_url && (
              <div style={{ marginTop: 16 }}>
                <a
                  href={tender.platform_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12.5, color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  Открыть на площадке
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" />
                  </svg>
                </a>
              </div>
            )}

            {/* AI-оценка */}
            <AiBlock
              tender={tender}
              onScored={(score, rec, analysis) =>
                setTender((t) => t ? { ...t, ai_match_score: score, ai_recommendation: rec as Tender["ai_recommendation"], ai_analysis: analysis } : t)
              }
            />

            {/* AI-смета (BOQ) */}
            <AiBoqBlock tender={tender} />

            {/* Activity Timeline */}
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
              <EntityTimeline doctype="Tender" name={tender.name} limit={20} />
            </div>

            {/* Кнопка ERPNext */}
            <div style={{ marginTop: 24 }}>
              <a
                href={`http://erp.olimp-ural.ru/app/tender/${tender.name}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", textAlign: "center",
                  fontSize: 12.5, padding: "9px 0", borderRadius: 10,
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)", textDecoration: "none",
                }}
              >
                Открыть в ERPNext
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
