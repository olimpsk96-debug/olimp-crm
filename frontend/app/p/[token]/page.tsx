"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";

// TipTap для read-only render документа
const ProposalEditor = dynamic(
  () => import("@/components/proposal/ProposalEditor").then((m) => m.ProposalEditor),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Загрузка…</div> },
);

interface PublicProposal {
  name: string; title: string;
  customer_name: string; project_title: string;
  total_amount: number; valid_until: string | null;
  content: object;
  merge: Record<string, Record<string, unknown>>;
  status: string;
  already_signed: boolean;
  signed_by_name: string | null;
  signed_at: string | null;
}

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

export default function PublicProposalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<PublicProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [success, setSuccess] = useState<{ name: string; at: string } | null>(null);

  useEffect(() => {
    fetch(`/api/p/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Ошибка сети"))
      .finally(() => setLoading(false));
  }, [token]);

  async function submitSignature() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert("Поставьте подпись"); return;
    }
    if (!signerName.trim()) {
      alert("Укажите ФИО"); return;
    }
    setSubmitting(true);
    try {
      const dataUrl = sigRef.current.toDataURL("image/png");
      const r = await fetch(`/api/p/${encodeURIComponent(token)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signer_name: signerName, signature_data_url: dataUrl }),
      });
      const d = await r.json();
      if (d.error) { alert("Ошибка: " + d.error); return; }
      setSuccess({ name: signerName, at: d.signed_at });
      setSigning(false);
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return <Centered>Загрузка КП…</Centered>;
  }
  if (error) {
    return (
      <Centered>
        <div style={{ fontSize: 18, color: "#d32f2f", marginBottom: 10 }}>⚠ {error}</div>
        <div style={{ fontSize: 13, color: "#666" }}>Свяжитесь с отправителем для получения новой ссылки.</div>
      </Centered>
    );
  }
  if (!data) return <Centered>Данные не найдены</Centered>;

  return (
    <div style={{
      minHeight: "100vh", background: "#f5f5f7", padding: "20px 16px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          background: "white", padding: 24, borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontWeight: 600 }}>
                {data.name}
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 6px", color: "#1d1d1f" }}>
                {data.title}
              </h1>
              <div style={{ fontSize: 13, color: "#666" }}>
                Для: <b>{data.customer_name || "—"}</b>
                {data.project_title && ` · ${data.project_title}`}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                Сумма КП
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#1d1d1f", fontFamily: "monospace" }}>
                {fmtMoney(data.total_amount)}
              </div>
              {data.valid_until && (
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                  Действует до: {data.valid_until}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Document content */}
        <div style={{
          background: "white", borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: 16,
          minHeight: 400, overflow: "hidden",
        }}>
          <ProposalEditor
            initialContent={data.content}
            onChange={() => {}}
            readOnly
            mergeData={data.merge}
          />
        </div>

        {/* Signature block / Status */}
        {success ? (
          <div style={{
            background: "white", padding: 30, borderRadius: 12, textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            border: "2px solid #22c55e",
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✓</div>
            <h2 style={{ fontSize: 22, margin: "0 0 8px", color: "#16a34a" }}>
              КП согласовано
            </h2>
            <div style={{ fontSize: 14, color: "#666" }}>
              <b>{success.name}</b><br />
              {success.at.split(".")[0]}
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: "#666" }}>
              Спасибо! Менеджер свяжется с вами для подписания договора.
            </div>
          </div>
        ) : data.already_signed ? (
          <div style={{
            background: "white", padding: 24, borderRadius: 12, textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            border: "1px solid #22c55e",
          }}>
            <div style={{ fontSize: 32 }}>✓</div>
            <h2 style={{ fontSize: 18, margin: "8px 0", color: "#16a34a" }}>Уже подписано</h2>
            <div style={{ fontSize: 13, color: "#666" }}>
              {data.signed_by_name} · {data.signed_at?.split(".")[0]}
            </div>
          </div>
        ) : signing ? (
          <div style={{
            background: "white", padding: 24, borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 14px" }}>
              ✍ Подпишите КП
            </h2>

            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
              Ваше ФИО *
            </label>
            <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)}
                   placeholder="Иванов Иван Иванович"
                   style={{
                     width: "100%", padding: "10px 12px", fontSize: 14,
                     background: "#f5f5f7", border: "1px solid #d2d2d7",
                     borderRadius: 8, outline: "none", marginBottom: 14,
                   }} />

            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
              Подпись *
            </label>
            <div style={{
              border: "2px dashed #d2d2d7", borderRadius: 10, padding: 4, marginBottom: 10,
              background: "#fafafa",
            }}>
              <SignatureCanvas ref={sigRef}
                               canvasProps={{
                                 width: 740, height: 180,
                                 style: { width: "100%", height: 180, borderRadius: 8, background: "white" },
                               }}
                               penColor="#1d1d1f" />
            </div>
            <button onClick={() => sigRef.current?.clear()}
                    style={{
                      padding: "5px 10px", fontSize: 12, marginBottom: 12,
                      background: "transparent", color: "#666",
                      border: "1px solid #d2d2d7", borderRadius: 6, cursor: "pointer",
                    }}>Очистить</button>

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button onClick={() => setSigning(false)} style={{
                padding: "12px 18px", fontSize: 14,
                background: "transparent", color: "#666",
                border: "1px solid #d2d2d7", borderRadius: 8, cursor: "pointer",
              }}>Отмена</button>
              <button onClick={submitSignature} disabled={submitting} style={{
                padding: "12px 24px", fontSize: 14, fontWeight: 500,
                background: "#1d1d1f", color: "white",
                border: "none", borderRadius: 8, cursor: "pointer",
                opacity: submitting ? 0.6 : 1,
              }}>
                {submitting ? "Отправка…" : "✓ Подписать и согласовать"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => setSigning(true)} style={{
              padding: "14px 32px", fontSize: 15, fontWeight: 500,
              background: "#1d1d1f", color: "white",
              border: "none", borderRadius: 10, cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}>
              ✍ Согласовать и подписать
            </button>
          </div>
        )}

        <div style={{ marginTop: 30, textAlign: "center", fontSize: 11, color: "#888" }}>
          ООО «Олимп» · Промышленное строительство · Екатеринбург
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f5f5f7", fontFamily: "system-ui, -apple-system, sans-serif",
      padding: 20,
    }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>{children}</div>
    </div>
  );
}
