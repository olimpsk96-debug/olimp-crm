"use client";

import { useCallback, useEffect, useState } from "react";
import type { PDFAnnotationDoc } from "@/types/pdf-annotation";
import PDFAnnotator from "@/components/pdf/PDFAnnotator";

const STATUS_COLOR: Record<string, string> = {
  "Черновик": "var(--text-tertiary)",
  "На согласовании": "var(--warning)",
  "Подписан": "var(--success)",
  "Отклонён": "var(--danger)",
};

const REF_DOCTYPES = [
  { value: "", label: "Все типы" },
  { value: "KS2 Act", label: "КС-2 акты" },
  { value: "KS3 Act", label: "КС-3 справки" },
  { value: "Construction Project", label: "Проекты" },
  { value: "Tender", label: "Тендеры" },
  { value: "Work Log", label: "Журналы КС-6" },
  { value: "Estimate", label: "Сметы" },
];

export default function PDFAnnotationsPage() {
  const [items, setItems] = useState<PDFAnnotationDoc[]>([]);
  const [refType, setRefType] = useState("");
  const [loading, setLoading] = useState(true);
  const [openDoc, setOpenDoc] = useState<PDFAnnotationDoc | null>(null);
  const [showNew, setShowNew] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (refType) params.set("reference_doctype", refType);
    try {
      const r = await fetch(`/api/pdf-annotation?${params}`);
      const d = await r.json();
      setItems(Array.isArray(d) ? d : []);
    } finally {
      setLoading(false);
    }
  }, [refType]);

  useEffect(() => { reload(); }, [reload]);

  async function openExisting(name: string) {
    const r = await fetch(`/api/pdf-annotation/${encodeURIComponent(name)}`);
    const d = await r.json();
    if (d && d.name) setOpenDoc(d);
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
            Разметка PDF
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Аннотации актов, чертежей и планов: замечания, штампы, подписи
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select value={refType} onChange={(e) => setRefType(e.target.value)}
                  style={{ padding: "8px 12px", fontSize: 12.5, borderRadius: 8, background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", outline: "none" }}>
            {REF_DOCTYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <button onClick={() => setShowNew(true)}
                  style={{ padding: "8px 16px", fontSize: 13, borderRadius: 9, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}>
            + Новая разметка
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13,
                      background: "var(--bg-elevated)", borderRadius: 12, border: "1px dashed var(--border-subtle)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          Разметок пока нет. Создай первую — прикрепи PDF и добавь аннотации.
        </div>
      ) : (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 140px 90px 130px 140px",
            gap: 0, padding: "12px 16px",
            background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)",
            fontSize: 10.5, color: "var(--text-tertiary)",
            textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace",
          }}>
            <div>Название</div>
            <div>Документ</div>
            <div>Статус</div>
            <div style={{ textAlign: "right" }}>Аннотаций</div>
            <div>Подписант</div>
            <div>Изменено</div>
          </div>

          {items.map((it) => (
            <div key={it.name}
                 onClick={() => openExisting(it.name!)}
                 style={{
                   display: "grid",
                   gridTemplateColumns: "1fr 1fr 140px 90px 130px 140px",
                   gap: 0, padding: "12px 16px",
                   borderBottom: "1px solid rgba(255,255,255,0.04)",
                   cursor: "pointer",
                 }}
                 onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                 onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{it.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                {it.reference_doctype} / {it.reference_name}
              </div>
              <div>
                <span style={{
                  padding: "3px 9px", borderRadius: 5, fontSize: 10.5,
                  background: `${STATUS_COLOR[it.status || "Черновик"]}22`,
                  color: STATUS_COLOR[it.status || "Черновик"],
                }}>{it.status || "Черновик"}</span>
              </div>
              <div style={{ textAlign: "right", fontFamily: "monospace", color: "var(--accent)" }}>
                {it.annotation_count || 0}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                {it.signed_by ? `✓ ${it.signed_by}` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                {it.modified ? new Date(it.modified).toLocaleDateString("ru-RU") : "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {openDoc && (
        <PDFAnnotator
          doc={openDoc}
          onClose={() => setOpenDoc(null)}
          onSaved={() => { setOpenDoc(null); reload(); }}
        />
      )}

      {showNew && (
        <NewAnnotationDialog
          onClose={() => setShowNew(false)}
          onCreated={(doc) => { setShowNew(false); setOpenDoc(doc); }}
        />
      )}
    </div>
  );
}

function NewAnnotationDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (doc: PDFAnnotationDoc) => void }) {
  const [title, setTitle] = useState("");
  const [refDoctype, setRefDoctype] = useState("KS2 Act");
  const [refName, setRefName] = useState("");
  const [pdfFile, setPdfFile] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) { setError("Укажи название"); return; }
    if (!refName.trim()) { setError("Укажи ID документа (например, KS2-2026-00001)"); return; }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/pdf-annotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, reference_doctype: refDoctype, reference_name: refName,
          pdf_file: pdfFile, status: "Черновик", annotations: [],
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setError(d.error || `Ошибка ${r.status}`); return; }
      // Загружаем созданную запись
      const r2 = await fetch(`/api/pdf-annotation/${encodeURIComponent(d.name)}`);
      const d2 = await r2.json();
      onCreated(d2);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
           style={{ width: 460, maxWidth: "92%", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 22 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 17 }}>Новая разметка PDF</h3>

        <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>Название</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
               placeholder="Замечания технадзора по КС-2 №3"
               style={{ width: "100%", padding: "9px 12px", fontSize: 13, marginBottom: 10, border: "1px solid var(--border-subtle)", borderRadius: 8, background: "var(--bg-elevated)", color: "var(--text-primary)", outline: "none" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>Тип документа</label>
            <select value={refDoctype} onChange={(e) => setRefDoctype(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid var(--border-subtle)", borderRadius: 8, background: "var(--bg-elevated)", color: "var(--text-primary)", outline: "none" }}>
              <option>KS2 Act</option>
              <option>KS3 Act</option>
              <option>Construction Project</option>
              <option>Tender</option>
              <option>Work Log</option>
              <option>Estimate</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>ID документа</label>
            <input value={refName} onChange={(e) => setRefName(e.target.value)}
                   placeholder="KS2-2026-00001"
                   style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid var(--border-subtle)", borderRadius: 8, background: "var(--bg-elevated)", color: "var(--text-primary)", outline: "none" }} />
          </div>
        </div>

        <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>URL PDF (опционально на этапе)</label>
        <input value={pdfFile} onChange={(e) => setPdfFile(e.target.value)}
               placeholder="/files/ks2-001.pdf или https://..."
               style={{ width: "100%", padding: "9px 12px", fontSize: 13, marginBottom: 14, border: "1px solid var(--border-subtle)", borderRadius: 8, background: "var(--bg-elevated)", color: "var(--text-primary)", outline: "none" }} />

        {error && (
          <div style={{ padding: 9, marginBottom: 12, background: "rgba(248,113,113,0.1)", color: "var(--danger)", borderRadius: 7, fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 9, fontSize: 13, cursor: "pointer" }}>
            Отмена
          </button>
          <button onClick={create} disabled={saving}
                  style={{ padding: "9px 18px", background: "var(--accent)", color: "white", border: "none", borderRadius: 9, fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "..." : "Создать и открыть"}
          </button>
        </div>
      </div>
    </div>
  );
}
