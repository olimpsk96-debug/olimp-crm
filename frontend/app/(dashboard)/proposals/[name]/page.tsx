"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

// TipTap требует SSR-disable в App Router (immediatelyRender: false + dynamic)
const ProposalEditor = dynamic(
  () => import("@/components/proposal/ProposalEditor").then((m) => m.ProposalEditor),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка редактора…</div> },
);

interface Proposal {
  name: string; title: string; customer: string | null; project: string | null;
  estimate_link: string | null; status: string;
  total_amount: number; valid_until: string | null;
  share_token: string | null; share_token_expires: string | null;
  sent_at: string | null; first_viewed_at: string | null; view_count: number;
  signed_at: string | null; signed_by_name: string | null;
  content_json: string | null;
  notes: string;
  modified: string;
  content?: object;
}

interface MergeData { [scope: string]: { [key: string]: unknown } }

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

export default function ProposalEditPage() {
  const params = useParams<{ name: string }>();
  const router = useRouter();
  const toast = useToast();
  const name = decodeURIComponent(params.name);

  const [doc, setDoc] = useState<Proposal | null>(null);
  const [mergeData, setMergeData] = useState<MergeData>({});
  const [content, setContent] = useState<object | null>(null);
  const [meta, setMeta] = useState({
    title: "", total_amount: 0, valid_until: "", status: "Черновик",
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [shareDialog, setShareDialog] = useState<{ url: string; expires: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/proposals/${encodeURIComponent(name)}`).then((r) => r.json()),
      fetch(`/api/proposals/${encodeURIComponent(name)}?mode=merge_data`).then((r) => r.json()),
    ]).then(([d, m]) => {
      if (d && !d.error) {
        setDoc(d);
        setMeta({
          title: d.title || "",
          total_amount: d.total_amount || 0,
          valid_until: d.valid_until || "",
          status: d.status || "Черновик",
        });
        setContent(d.content || { type: "doc", content: [{ type: "paragraph" }] });
      } else {
        toast.error("Не удалось загрузить КП");
      }
      if (m && !m.error) setMergeData(m);
    });
  }, [name, toast]);

  const save = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const r = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          name: doc.name,
          title: meta.title,
          customer: doc.customer || "",
          project: doc.project || "",
          estimate_link: doc.estimate_link || "",
          status: meta.status,
          total_amount: meta.total_amount,
          valid_until: meta.valid_until,
          content_json: JSON.stringify(content || {}),
        }),
      });
      const d = await r.json();
      if (d.error) toast.error(d.error);
      else { toast.success("Сохранено"); setDirty(false); }
    } finally { setSaving(false); }
  }, [doc, meta, content, toast]);

  // Cmd+S — сохранить
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

  async function generateShareLink() {
    if (dirty) {
      if (!window.confirm("Есть несохранённые изменения. Сначала сохранить?")) return;
      await save();
    }
    const r = await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_token", name, ttl_days: 30 }),
    });
    const d = await r.json();
    if (d.error) { toast.error(d.error); return; }
    // Frontend URL (текущий хост)
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setShareDialog({ url: `${base}/p/${d.token}`, expires: d.expires });
    toast.success("Ссылка для клиента сгенерирована");
  }

  async function downloadExport(format: "pdf" | "docx") {
    if (dirty) {
      if (!window.confirm("Есть несохранённые изменения. Сохранить перед экспортом?")) return;
      await save();
    }
    // Открываем в новой вкладке — браузер сам скачает
    window.open(`/api/proposals/${encodeURIComponent(name)}/export?format=${format}`, "_blank");
  }

  async function markSent() {
    const r = await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_sent", name }),
    });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success("Отмечено как отправленное"); setMeta({ ...meta, status: "Отправлено" }); }
  }

  if (!doc) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка…</div>;
  }

  return (
    <div style={{ padding: "20px 24px 40px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <Link href="/proposals" style={{
          fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8,
        }}>← К списку КП</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <input value={meta.title}
                   onChange={(e) => { setMeta({ ...meta, title: e.target.value }); setDirty(true); }}
                   style={{
                     width: "100%", fontSize: 22, fontWeight: 500, padding: "4px 8px",
                     background: "transparent", color: "var(--text-primary)",
                     border: "1px solid transparent", borderRadius: 6, outline: "none",
                   }}
                   placeholder="Название КП" />
            <div style={{ marginTop: 4, padding: "0 8px", fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
              {doc.name} · {doc.customer && `${mergeData?.customer?.name || doc.customer} · `}
              {fmtMoney(meta.total_amount)} · статус: {meta.status}
              {doc.view_count > 0 && ` · 👁 ${doc.view_count} просмотров`}
              {doc.signed_by_name && ` · ✓ подписал ${doc.signed_by_name}`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={save} disabled={saving}
                    style={{
                      padding: "9px 16px", fontSize: 13, fontWeight: 500,
                      background: dirty ? "var(--accent)" : "var(--bg-elevated)",
                      color: dirty ? "white" : "var(--text-secondary)",
                      border: `1px solid ${dirty ? "var(--accent)" : "var(--border-subtle)"}`,
                      borderRadius: 7, cursor: "pointer",
                      opacity: saving ? 0.6 : 1,
                    }}>
              {saving ? "..." : dirty ? "💾 Сохранить" : "✓ Сохранено"}
            </button>
            <button onClick={() => downloadExport("pdf")}
                    style={exportBtnStyle}
                    title="Скачать PDF">
              📄 PDF
            </button>
            <button onClick={() => downloadExport("docx")}
                    style={exportBtnStyle}
                    title="Скачать DOCX">
              📝 DOCX
            </button>
            <button onClick={generateShareLink}
                    style={{
                      padding: "9px 16px", fontSize: 13, fontWeight: 500,
                      background: "var(--bg-elevated)", color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)", borderRadius: 7, cursor: "pointer",
                    }}>
              🔗 Поделиться
            </button>
            {meta.status === "Готово к отправке" && (
              <button onClick={markSent}
                      style={{
                        padding: "9px 16px", fontSize: 13, fontWeight: 500,
                        background: "#7c3aed", color: "white",
                        border: "none", borderRadius: 7, cursor: "pointer",
                      }}>
                ✉ Отметить отправленным
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar + Editor */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 14 }}>
        <div>
          {content !== null && (
            <ProposalEditor
              initialContent={content}
              onChange={(json) => { setContent(json); setDirty(true); }}
              mergeData={mergeData}
              placeholder="Начните писать КП… Используйте кнопки сверху для вставки таблицы, графика оплат или merge-тегов"
            />
          )}
        </div>

        {/* Sidebar — метаданные */}
        <aside style={{
          padding: 14, background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)", borderRadius: 10,
          height: "fit-content", position: "sticky", top: 14,
        }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "monospace", marginBottom: 8 }}>
            Параметры КП
          </div>

          <label style={lbl}>Сумма КП ₽</label>
          <input type="number" min={0} value={meta.total_amount}
                 onChange={(e) => { setMeta({ ...meta, total_amount: parseFloat(e.target.value) || 0 }); setDirty(true); }}
                 style={inp} />

          <label style={lbl}>Действует до</label>
          <input type="date" value={meta.valid_until}
                 onChange={(e) => { setMeta({ ...meta, valid_until: e.target.value }); setDirty(true); }}
                 style={inp} />

          <label style={lbl}>Статус</label>
          <select value={meta.status}
                  onChange={(e) => { setMeta({ ...meta, status: e.target.value }); setDirty(true); }}
                  style={inp}>
            <option>Черновик</option>
            <option>Готово к отправке</option>
            <option>Отправлено</option>
            <option>Просмотрено клиентом</option>
            <option>Согласовано</option>
            <option>Отклонено</option>
            <option>Истекло</option>
          </select>

          {doc.share_token && (
            <>
              <div style={{ marginTop: 14, padding: 10, borderRadius: 7,
                            background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)" }}>
                <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, marginBottom: 4, fontFamily: "monospace" }}>
                  Share-ссылка активна
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  Истекает: {doc.share_token_expires?.split(" ")[0]}
                </div>
                <button onClick={() => {
                  const url = `${window.location.origin}/p/${doc.share_token}`;
                  navigator.clipboard.writeText(url);
                  toast.success("Скопировано");
                }} style={{
                  marginTop: 6, padding: "4px 10px", fontSize: 11,
                  background: "transparent", color: "#3b82f6",
                  border: "1px solid #3b82f6", borderRadius: 5, cursor: "pointer", width: "100%",
                }}>📋 Копировать ссылку</button>
              </div>
            </>
          )}

          {doc.signed_by_name && (
            <div style={{ marginTop: 14, padding: 10, borderRadius: 7,
                          background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)" }}>
              <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 600, marginBottom: 4, fontFamily: "monospace" }}>
                ✓ Подписано клиентом
              </div>
              <div style={{ fontSize: 12, marginBottom: 2 }}>{doc.signed_by_name}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {doc.signed_at?.split(".")[0]}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
            Ctrl+S — сохранить
          </div>
        </aside>
      </div>

      {/* Share link dialog */}
      {shareDialog && (
        <div onClick={() => setShareDialog(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: "100%", maxWidth: 540, background: "var(--bg-base)",
            borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 24,
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 16px" }}>
              🔗 Ссылка для клиента
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
              Отправьте эту ссылку клиенту. Он откроет КП в браузере, прочитает и подпишет онлайн.
            </p>
            <div style={{
              padding: "10px 12px", borderRadius: 7,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", marginBottom: 12,
            }}>{shareDialog.url}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>
              Действует до: {shareDialog.expires.split(".")[0]}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShareDialog(null)} style={{
                padding: "9px 16px", fontSize: 13,
                background: "transparent", color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)", borderRadius: 7, cursor: "pointer",
              }}>Закрыть</button>
              <button onClick={() => {
                navigator.clipboard.writeText(shareDialog.url);
                toast.success("Скопировано");
              }} style={{
                padding: "9px 20px", fontSize: 13, fontWeight: 500,
                background: "var(--accent)", color: "white",
                border: "none", borderRadius: 7, cursor: "pointer",
              }}>📋 Копировать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "block", fontSize: 10, color: "var(--text-tertiary)",
  textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace",
  marginTop: 10, marginBottom: 4,
};
const inp: React.CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 12.5,
  background: "var(--bg-base)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 6, outline: "none",
};
const exportBtnStyle: React.CSSProperties = {
  padding: "9px 14px", fontSize: 13, fontWeight: 500,
  background: "var(--bg-elevated)", color: "var(--text-secondary)",
  border: "1px solid var(--border-subtle)", borderRadius: 7, cursor: "pointer",
};
