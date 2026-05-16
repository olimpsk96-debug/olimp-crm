"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFAnnotationDoc, PDFAnnotationItem, PDFAnnotationKind } from "@/types/pdf-annotation";

const TOOL_COLORS: Record<PDFAnnotationKind, string> = {
  note: "#FBBF24",      // жёлтый — пометка
  rect: "#60A5FA",      // синий — выделение области
  stamp: "#22C55E",     // зелёный — штамп ОК / Согласовано
  signature: "#EA580C", // оранжевый — место подписи
};

const TOOL_LABELS: Record<PDFAnnotationKind, string> = {
  note: "📝 Пометка",
  rect: "▢ Выделение",
  stamp: "✓ Штамп",
  signature: "✍️ Подпись",
};

/**
 * MVP PDF-аннотатор без тяжёлых либ (react-pdf, pdfjs):
 * - PDF просматривается через нативный <embed src="...">
 * - Аннотации = absolute-positioned divs поверх embed
 * - Координаты в % контейнера → не плывут при ресайзе
 * - Клик «Добавить» включает режим → следующий клик создаёт аннотацию
 *
 * Ограничения MVP:
 * - Не отрисовываем pdf-страницы как canvas (нельзя точно знать где конец 1-й страницы)
 * - Считаем что весь embed — это «страница 1» (page всегда 1)
 * - Для production-уровня PDF разметки нужен react-pdf или pdf.js рендеринг
 *   на canvas с page-by-page координатами
 */
export default function PDFAnnotator({
  doc,
  onSaved,
  onClose,
}: {
  doc: PDFAnnotationDoc;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [annotations, setAnnotations] = useState<PDFAnnotationItem[]>(doc.annotations || []);
  const [activeTool, setActiveTool] = useState<PDFAnnotationKind | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signedBy, setSignedBy] = useState("");
  const [signedRole, setSignedRole] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  const addAnnotation = useCallback((kind: PDFAnnotationKind, x: number, y: number) => {
    const newItem: PDFAnnotationItem = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      kind,
      page: 1,
      x, y,
      text: kind === "stamp" ? "ОК" : "",
      color: TOOL_COLORS[kind],
      created: new Date().toISOString(),
    };
    setAnnotations((arr) => [...arr, newItem]);
    setEditingId(newItem.id);
    setActiveTool(null);
  }, []);

  const onContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTool || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    addAnnotation(activeTool, x, y);
  }, [activeTool, addAnnotation]);

  function updateAnnotation(id: string, patch: Partial<PDFAnnotationItem>) {
    setAnnotations((arr) => arr.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function removeAnnotation(id: string) {
    setAnnotations((arr) => arr.filter((a) => a.id !== id));
    if (editingId === id) setEditingId(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = doc.name ? `/api/pdf-annotation/${encodeURIComponent(doc.name)}` : "/api/pdf-annotation";
      const method = doc.name ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...doc, annotations }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.error || `Ошибка ${r.status}`);
        return;
      }
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function sign() {
    if (!doc.name) { setError("Сначала сохрани разметку"); return; }
    if (!signedBy.trim()) { setError("Укажи ФИО"); return; }
    setSaving(true);
    try {
      const p = new URLSearchParams();
      p.set("name", doc.name);
      p.set("signed_by", signedBy);
      if (signedRole) p.set("signed_role", signedRole);
      const r = await fetch(`/api/pdf-annotation/${encodeURIComponent(doc.name)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signed_by: signedBy, signed_role: signedRole }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setError(d.error || `Ошибка ${r.status}`); return; }
      setSigning(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setActiveTool(null); setEditingId(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const pdfUrl = doc.pdf_file
    ? (doc.pdf_file.startsWith("http") ? doc.pdf_file : `http://erp.olimp-ural.ru${doc.pdf_file}`)
    : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", flexDirection: "column" }}>
      {/* Тулбар */}
      <div style={{
        flexShrink: 0, padding: "10px 16px",
        background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{doc.title}</h3>
          <span style={{
            padding: "3px 9px", borderRadius: 5, fontSize: 10.5, fontFamily: "monospace",
            background: doc.status === "Подписан" ? "rgba(34,197,94,0.15)" : "rgba(251,191,36,0.15)",
            color: doc.status === "Подписан" ? "var(--success)" : "var(--warning)",
          }}>{doc.status || "Черновик"}</span>
          <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
            {annotations.length} аннотаций
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {(["note", "rect", "stamp", "signature"] as PDFAnnotationKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setActiveTool((t) => (t === k ? null : k))}
              style={{
                padding: "7px 12px", fontSize: 12, borderRadius: 7,
                border: `1px solid ${activeTool === k ? TOOL_COLORS[k] : "var(--border-subtle)"}`,
                background: activeTool === k ? `${TOOL_COLORS[k]}22` : "transparent",
                color: activeTool === k ? TOOL_COLORS[k] : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {TOOL_LABELS[k]}
            </button>
          ))}
          <button onClick={save} disabled={saving}
                  style={{ padding: "7px 16px", fontSize: 12, fontWeight: 500, borderRadius: 7,
                           background: "var(--accent)", color: "white", border: "none", cursor: "pointer",
                           opacity: saving ? 0.6 : 1 }}>
            {saving ? "..." : "💾 Сохранить"}
          </button>
          {doc.name && doc.status !== "Подписан" && (
            <button onClick={() => setSigning(true)}
                    style={{ padding: "7px 16px", fontSize: 12, borderRadius: 7,
                             background: "rgba(34,197,94,0.15)", color: "var(--success)",
                             border: "1px solid var(--success)", cursor: "pointer" }}>
              ✓ Подписать
            </button>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
      </div>

      {/* Сообщение о режиме инструмента */}
      {activeTool && (
        <div style={{ padding: "6px 16px", background: `${TOOL_COLORS[activeTool]}11`, fontSize: 12, color: TOOL_COLORS[activeTool], borderBottom: `1px solid ${TOOL_COLORS[activeTool]}` }}>
          🎯 Кликни на PDF чтобы добавить «{TOOL_LABELS[activeTool]}». Esc — отменить.
        </div>
      )}

      {error && (
        <div style={{ padding: "8px 16px", background: "rgba(248,113,113,0.15)", color: "var(--danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Основная область: PDF слева, список аннотаций справа */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div
          ref={containerRef}
          onClick={onContainerClick}
          style={{
            flex: 1, position: "relative",
            background: "#404040",
            cursor: activeTool ? "crosshair" : "default",
          }}
        >
          {pdfUrl ? (
            <embed src={pdfUrl} type="application/pdf"
                   style={{ width: "100%", height: "100%", pointerEvents: activeTool ? "none" : "auto" }} />
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "white" }}>
              PDF не загружен. Сначала прикрепи файл в карточке.
            </div>
          )}

          {/* Overlay аннотаций */}
          {annotations.map((a) => (
            <div
              key={a.id}
              onClick={(e) => { e.stopPropagation(); setEditingId(a.id); }}
              style={{
                position: "absolute",
                left: `${a.x}%`, top: `${a.y}%`,
                transform: "translate(-50%, -50%)",
                padding: "6px 10px",
                background: a.color || TOOL_COLORS[a.kind],
                color: a.kind === "stamp" ? "white" : "#1a1a1a",
                borderRadius: a.kind === "stamp" ? 4 : 8,
                fontSize: 11.5, fontWeight: a.kind === "stamp" ? 600 : 400,
                maxWidth: 200,
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                cursor: "pointer",
                outline: editingId === a.id ? "2px solid var(--accent)" : "none",
                pointerEvents: "auto",
              }}
            >
              {a.kind === "stamp" ? (a.text || "ОК") :
               a.kind === "signature" ? (a.text ? a.text : "📝 Подпись") :
               a.text ? a.text.substring(0, 50) : "(пусто)"}
            </div>
          ))}
        </div>

        {/* Правая панель */}
        <div style={{ width: 320, flexShrink: 0, background: "var(--bg-base)", borderLeft: "1px solid var(--border-subtle)", overflow: "auto", padding: 14 }}>
          {signing ? (
            <div>
              <h4 style={{ fontSize: 13, margin: "0 0 12px" }}>Подписать разметку</h4>
              <label style={lblStyle}>ФИО подписанта *</label>
              <input style={inpStyle} value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="Иванов И.И." />
              <label style={lblStyle}>Роль</label>
              <select style={inpStyle} value={signedRole} onChange={(e) => setSignedRole(e.target.value)}>
                <option value="">—</option>
                <option>Заказчик</option>
                <option>Технический надзор</option>
                <option>Подрядчик</option>
                <option>Генеральный директор</option>
                <option>Главный инженер</option>
              </select>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={sign} disabled={saving}
                        style={{ flex: 1, padding: "8px", background: "var(--success)", color: "white", border: "none", borderRadius: 7, cursor: "pointer" }}>
                  {saving ? "..." : "Подписать"}
                </button>
                <button onClick={() => setSigning(false)}
                        style={{ padding: "8px 14px", background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 7, cursor: "pointer" }}>
                  Отмена
                </button>
              </div>
            </div>
          ) : editingId ? (
            (() => {
              const a = annotations.find((x) => x.id === editingId);
              if (!a) return null;
              return (
                <div>
                  <h4 style={{ fontSize: 13, margin: "0 0 12px" }}>{TOOL_LABELS[a.kind]}</h4>
                  <label style={lblStyle}>Текст</label>
                  <textarea
                    style={{ ...inpStyle, minHeight: 80, fontFamily: "inherit" }}
                    value={a.text || ""}
                    onChange={(e) => updateAnnotation(a.id, { text: e.target.value })}
                    placeholder={a.kind === "stamp" ? "ОК / СОГЛАСОВАНО / ОТКЛОНЕНО" :
                                 a.kind === "signature" ? "Иванов И.И." :
                                 "Замечание / комментарий"}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                    <button onClick={() => removeAnnotation(a.id)}
                            style={{ padding: "6px 12px", fontSize: 11, background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 6, cursor: "pointer" }}>
                      Удалить
                    </button>
                    <button onClick={() => setEditingId(null)}
                            style={{ padding: "6px 12px", fontSize: 11, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, cursor: "pointer", marginLeft: "auto" }}>
                      Готово
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <>
              <h4 style={{ fontSize: 13, margin: "0 0 12px" }}>Все аннотации ({annotations.length})</h4>
              {annotations.length === 0 && (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
                  Аннотаций пока нет. Выбери инструмент сверху и кликни на PDF.
                </div>
              )}
              {annotations.map((a, i) => (
                <div key={a.id}
                     onClick={() => setEditingId(a.id)}
                     style={{
                       padding: "8px 10px", marginBottom: 6, borderRadius: 7,
                       border: "1px solid var(--border-subtle)",
                       cursor: "pointer", fontSize: 11.5,
                       display: "flex", justifyContent: "space-between", gap: 10,
                     }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: a.color || TOOL_COLORS[a.kind], fontSize: 10.5, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      #{i + 1} {TOOL_LABELS[a.kind]}
                    </div>
                    <div style={{ color: "var(--text-primary)", marginTop: 2 }}>
                      {a.text || "(пусто)"}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeAnnotation(a.id); }}
                          style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14 }}>×</button>
                </div>
              ))}
            </>
          )}

          {doc.signed_by && (
            <div style={{ marginTop: 18, padding: 12, background: "rgba(34,197,94,0.08)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.3)" }}>
              <div style={{ fontSize: 10, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Подписано</div>
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 3 }}>{doc.signed_by}</div>
              {doc.signed_role && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{doc.signed_role}</div>}
              {doc.signed_at && <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2 }}>{new Date(doc.signed_at).toLocaleString("ru-RU")}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inpStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 12.5, color: "var(--text-primary)",
  background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 7,
  outline: "none", width: "100%", marginBottom: 6,
};
const lblStyle: React.CSSProperties = {
  display: "block", fontSize: 10, color: "var(--text-tertiary)",
  marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace",
};
