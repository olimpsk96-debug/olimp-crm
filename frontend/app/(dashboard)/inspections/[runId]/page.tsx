"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

interface Question {
  id: string;
  text: string;
  kind: "yesno" | "score" | "photo" | "text" | "number";
  weight: number;
  critical?: boolean;
}

interface Answer {
  question_id: string;
  answer?: string | boolean | number;
  comment?: string;
  photo_url?: string;
}

export default function InspectionRunPage() {
  const params = useParams<{ runId: string }>();
  const runId = decodeURIComponent(params.runId);
  const router = useRouter();
  const toast = useToast();

  const [run, setRun] = useState<{ name: string; title: string; template: string; status: string; score_pct?: number; critical_fails?: number } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Получаем Inspection Run + связанный шаблон
    fetch(`/api/inspections/runs?days=365`)
      .then((r) => r.json())
      .then((all: { name: string; title: string; template: string; status: string; score_pct?: number; critical_fails?: number }[]) => {
        const r = all.find((x) => x.name === runId);
        if (r) {
          setRun(r);
          // Загружаем шаблон
          return fetch(`/api/inspections/${encodeURIComponent(r.template)}`).then((rr) => rr.json());
        }
        return null;
      })
      .then((tpl) => {
        if (tpl && tpl.questions) setQuestions(tpl.questions);
      })
      .finally(() => setLoading(false));
  }, [runId]);

  function updateAnswer(qid: string, patch: Partial<Answer>) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], question_id: qid, ...patch } }));
  }

  async function submit(finish: boolean) {
    setSaving(true);
    try {
      const payload = {
        run_id: runId,
        answers: Object.values(answers),
        notes,
        finish: finish ? 1 : 0,
      };
      const r = await fetch("/api/inspections/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.error) {
        toast.error(d.error);
        return;
      }
      if (finish) {
        const verdict = d.critical_fails > 0 ? "❌ FAIL" : "✓ PASS";
        toast.success(`${verdict} · Score: ${d.score_pct}% · Критических: ${d.critical_fails}`, 9000);
        router.push("/inspections");
      } else {
        toast.success("Сохранено (draft)");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>;
  }

  if (!run) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Проверка не найдена</div>;
  }

  const answeredCount = Object.values(answers).filter((a) => a.answer !== undefined && a.answer !== "").length;
  const totalCount = questions.length;
  const isFinished = run.status !== "В работе";

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <button onClick={() => router.push("/inspections")} style={{
          background: "none", border: "none", color: "var(--text-tertiary)",
          cursor: "pointer", fontSize: 12, padding: "0 0 8px",
        }}>← К списку</button>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>{run.title}</h1>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
          {runId} · {answeredCount}/{totalCount} заполнено · {run.status}
          {isFinished && run.score_pct !== undefined && ` · Score ${run.score_pct}%`}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 2, overflow: "hidden", marginBottom: 18 }}>
        <div style={{
          height: "100%", width: `${totalCount ? (answeredCount / totalCount) * 100 : 0}%`,
          background: "var(--accent)", transition: "width 0.3s",
        }} />
      </div>

      {/* Questions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {questions.map((q, idx) => (
          <div key={q.id} style={{
            padding: 16, borderRadius: 10,
            background: "var(--bg-elevated)",
            border: `1px solid ${q.critical ? "rgba(248,113,113,0.4)" : "var(--border-subtle)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", flexShrink: 0 }}>
                {idx + 1}/{totalCount}
              </span>
              <div style={{ flex: 1, fontSize: 13.5 }}>
                {q.text}
                {q.critical && (
                  <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: "rgba(248,113,113,0.15)", color: "var(--danger)", fontSize: 9.5, fontWeight: 600 }}>
                    КРИТ
                  </span>
                )}
              </div>
            </div>

            {q.kind === "yesno" && (
              <div style={{ display: "flex", gap: 6, marginLeft: 32 }}>
                {[
                  { v: "yes", label: "✓ Да", color: "var(--success)" },
                  { v: "no", label: "✕ Нет", color: "var(--danger)" },
                  { v: "n/a", label: "N/A", color: "var(--text-tertiary)" },
                ].map((opt) => (
                  <button key={opt.v} onClick={() => updateAnswer(q.id, { answer: opt.v })}
                          disabled={isFinished}
                          style={{
                            padding: "6px 14px", fontSize: 12, fontWeight: 500,
                            background: answers[q.id]?.answer === opt.v ? opt.color : "transparent",
                            color: answers[q.id]?.answer === opt.v ? "white" : opt.color,
                            border: `1px solid ${opt.color}`, borderRadius: 7,
                            cursor: isFinished ? "default" : "pointer",
                            opacity: isFinished ? 0.6 : 1,
                          }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {q.kind === "score" && (
              <div style={{ display: "flex", gap: 4, marginLeft: 32 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => updateAnswer(q.id, { answer: s })}
                          disabled={isFinished}
                          style={{
                            width: 36, height: 36, fontSize: 14, fontWeight: 600,
                            background: answers[q.id]?.answer === s ? "var(--accent)" : "transparent",
                            color: answers[q.id]?.answer === s ? "white" : "var(--text-secondary)",
                            border: "1px solid var(--border-subtle)", borderRadius: 8,
                            cursor: isFinished ? "default" : "pointer",
                          }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {q.kind === "text" && (
              <textarea value={String(answers[q.id]?.answer || "")}
                        onChange={(e) => updateAnswer(q.id, { answer: e.target.value })}
                        disabled={isFinished}
                        placeholder="Заметка / описание..."
                        style={{
                          width: "calc(100% - 32px)",
                          padding: "9px 12px", fontSize: 12.5, marginLeft: 32,
                          background: "var(--bg-base)", color: "var(--text-primary)",
                          border: "1px solid var(--border-subtle)", borderRadius: 7,
                          outline: "none", minHeight: 60, fontFamily: "inherit",
                        }} />
            )}

            {q.kind === "photo" && (
              <div style={{ marginLeft: 32 }}>
                <input type="text" value={String(answers[q.id]?.answer || "")}
                       onChange={(e) => updateAnswer(q.id, { answer: e.target.value })}
                       disabled={isFinished}
                       placeholder="URL фото (или загрузи в /files и вставь путь)"
                       style={{
                         width: "100%", padding: "9px 12px", fontSize: 12,
                         background: "var(--bg-base)", color: "var(--text-primary)",
                         border: "1px solid var(--border-subtle)", borderRadius: 7,
                         outline: "none", fontFamily: "monospace",
                       }} />
              </div>
            )}

            {q.kind === "number" && (
              <input type="number" value={String(answers[q.id]?.answer || "")}
                     onChange={(e) => updateAnswer(q.id, { answer: parseFloat(e.target.value) || 0 })}
                     disabled={isFinished}
                     style={{
                       padding: "9px 12px", fontSize: 13, marginLeft: 32,
                       background: "var(--bg-base)", color: "var(--text-primary)",
                       border: "1px solid var(--border-subtle)", borderRadius: 7,
                       outline: "none", width: 120, fontFamily: "monospace",
                     }} />
            )}
          </div>
        ))}
      </div>

      {/* Common notes */}
      <div style={{ marginTop: 18 }}>
        <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4 }}>
          Общий комментарий
        </label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  disabled={isFinished}
                  placeholder="Замечания, вывод, рекомендации..."
                  style={{
                    width: "100%", padding: "10px 12px", fontSize: 13,
                    background: "var(--bg-elevated)", color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)", borderRadius: 8,
                    outline: "none", minHeight: 80, fontFamily: "inherit",
                  }} />
      </div>

      {/* Actions */}
      {!isFinished && (
        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => submit(false)} disabled={saving}
                  style={{ padding: "11px 18px", fontSize: 13,
                           background: "var(--bg-elevated)", color: "var(--text-secondary)",
                           border: "1px solid var(--border-subtle)", borderRadius: 9, cursor: "pointer" }}>
            💾 Сохранить как draft
          </button>
          <button onClick={() => submit(true)} disabled={saving || answeredCount === 0}
                  style={{ padding: "11px 22px", fontSize: 13, fontWeight: 500,
                           background: "var(--accent)", color: "white",
                           border: "none", borderRadius: 9, cursor: "pointer",
                           opacity: saving || answeredCount === 0 ? 0.6 : 1 }}>
            ✓ Завершить проверку
          </button>
        </div>
      )}
    </div>
  );
}
