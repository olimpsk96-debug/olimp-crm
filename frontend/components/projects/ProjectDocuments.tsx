"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ProjectFile {
  name: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  is_private: number;
  description?: string;
  category: string;
  comment: string;
  owner: string;
  creation: string;
}

const CATEGORIES = [
  "Договор", "Смета (PDF)", "Чертёж", "Сертификат материала",
  "Паспорт оборудования", "Фотофиксация", "Акт скрытых работ",
  "Исполнительная документация", "Переписка", "Прочее",
];

const CAT_ICON: Record<string, string> = {
  "Договор": "📄",
  "Смета (PDF)": "💰",
  "Чертёж": "📐",
  "Сертификат материала": "📜",
  "Паспорт оборудования": "🛠",
  "Фотофиксация": "📷",
  "Акт скрытых работ": "🔧",
  "Исполнительная документация": "📚",
  "Переписка": "✉️",
  "Прочее": "📎",
};

function fmtSize(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export function ProjectDocuments({ project }: { project: string }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("Договор");
  const [uploadComment, setUploadComment] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const data = await fetch(`/api/project-documents?project=${encodeURIComponent(project)}`).then(r => r.json());
    setFiles(Array.isArray(data) ? data : []);
  }, [project]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = String(ev.target?.result ?? "").split(",")[1];
        await fetch("/api/project-documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project,
            file_name: file.name,
            file_content: base64,
            category: uploadCategory,
            comment: uploadComment,
            is_private: 1,
          }),
        });
        setUploadComment("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        load();
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm("Удалить файл?")) return;
    await fetch("/api/project-documents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_name: name }),
    });
    load();
  }

  const filtered = categoryFilter ? files.filter(f => f.category === categoryFilter) : files;
  const grouped = CATEGORIES.map(c => ({ category: c, count: files.filter(f => f.category === c).length })).filter(g => g.count > 0);

  return (
    <div>
      {/* Upload bar */}
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px", fontFamily: "monospace" }}>Загрузить документ</p>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr auto", gap: 10, alignItems: "center" }}>
          <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} style={selectStyle}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICON[c]} {c}</option>)}
          </select>
          <input
            type="text"
            value={uploadComment}
            onChange={(e) => setUploadComment(e.target.value)}
            placeholder="Комментарий (необязательно)"
            style={inputStyle}
          />
          <label style={{
            padding: "8px 14px", borderRadius: 8, background: "var(--accent)", color: "white",
            fontSize: 12.5, fontWeight: 500, cursor: uploading ? "wait" : "pointer", whiteSpace: "nowrap",
          }}>
            {uploading ? "Загрузка..." : "📎 Выбрать файл"}
            <input ref={fileInputRef} type="file" onChange={handleUpload} disabled={uploading} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      {/* Category chips */}
      {grouped.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <button onClick={() => setCategoryFilter("")} style={{
            ...chipStyle,
            background: !categoryFilter ? "var(--accent)" : "transparent",
            color: !categoryFilter ? "white" : "var(--text-secondary)",
            border: !categoryFilter ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
          }}>
            Все ({files.length})
          </button>
          {grouped.map(g => (
            <button key={g.category} onClick={() => setCategoryFilter(g.category)} style={{
              ...chipStyle,
              background: categoryFilter === g.category ? "var(--accent)" : "transparent",
              color: categoryFilter === g.category ? "white" : "var(--text-secondary)",
              border: categoryFilter === g.category ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
            }}>
              {CAT_ICON[g.category]} {g.category} ({g.count})
            </button>
          ))}
        </div>
      )}

      {/* Files list */}
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
            {files.length === 0 ? "Документов пока нет. Загрузите первый файл." : `В категории «${categoryFilter}» документов нет`}
          </div>
        ) : filtered.map((f, i) => (
          <div key={f.name} style={{
            padding: "12px 18px",
            borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
            display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 14, alignItems: "center",
          }}>
            <span style={{ fontSize: 22 }}>{CAT_ICON[f.category]}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                {f.category} · {fmtSize(f.file_size)} · {fmtDate(f.creation)} · {f.owner.split("@")[0]}
                {f.comment && <span style={{ color: "var(--text-secondary)" }}> · {f.comment}</span>}
              </div>
            </div>
            <a href={f.file_url} target="_blank" rel="noreferrer" style={{
              padding: "5px 12px", borderRadius: 6, fontSize: 11,
              background: "transparent", border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)", textDecoration: "none",
            }}>Открыть</a>
            <a href={`${f.file_url}?download=1`} download style={{
              padding: "5px 12px", borderRadius: 6, fontSize: 11,
              background: "transparent", border: "1px solid var(--accent)",
              color: "var(--accent)", textDecoration: "none",
            }}>↓ Скачать</a>
            <button onClick={() => handleDelete(f.name)} style={{
              padding: "5px 10px", borderRadius: 6, fontSize: 12,
              background: "transparent", border: "1px solid var(--border-subtle)",
              color: "var(--text-tertiary)", cursor: "pointer",
            }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "8px 10px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" };
const selectStyle: React.CSSProperties = { ...inputStyle };
const chipStyle: React.CSSProperties = { padding: "5px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: 500 };
