"use client";

import { useState } from "react";

interface Row { [k: string]: string }
interface ImportResult {
  ok: true;
  dry_run: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; name?: string; error: string }>;
}

// Простой CSV-парсер. Поддерживает quoted-fields с запятыми и двойные кавычки.
function parseCSV(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  function splitLine(s: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQuote) {
        if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuote = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === ",") { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  const headers = splitLine(lines[0]!).map((h) => h.trim());
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitLine(lines[i]!);
    const obj: Row = {};
    headers.forEach((h, idx) => {
      obj[h] = (fields[idx] || "").trim();
    });
    rows.push(obj);
  }
  return rows;
}

const REQUIRED_FIELDS = ["customer_name"];
const KNOWN_FIELDS = [
  "customer_name", "customer_type", "mobile_no", "email_id",
  "tax_id", "website", "industry", "customer_details",
  "territory", "customer_group",
];

export default function ClientsImportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setError("CSV пустой или нет данных после заголовка");
          return;
        }
        // Проверка required
        const headers = Object.keys(parsed[0]!);
        for (const f of REQUIRED_FIELDS) {
          if (!headers.includes(f)) {
            setError(`Отсутствует обязательная колонка: ${f}`);
            return;
          }
        }
        setRows(parsed);
      } catch (e) {
        setError("Не удалось распарсить CSV: " + String(e));
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function runImport(dryRun: boolean) {
    if (rows.length === 0) { setError("Сначала загрузи CSV"); return; }
    setImporting(true);
    setError(null);
    try {
      const r = await fetch("/api/clients/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, dry_run: dryRun ? 1 : 0 }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setError(d.error || `Ошибка ${r.status}`); return; }
      setResult(d as ImportResult);
    } finally {
      setImporting(false);
    }
  }

  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const unknownHeaders = headers.filter((h) => !KNOWN_FIELDS.includes(h));

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
          Импорт клиентов из CSV
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
          Массовая загрузка базы клиентов. Дубли по customer_name пропускаются.
        </p>
      </div>

      {/* Загрузка файла */}
      <div style={{
        padding: 24, borderRadius: 12, marginBottom: 20,
        background: "var(--bg-elevated)", border: "1px dashed var(--border-subtle)",
        textAlign: "center",
      }}>
        <input id="csv" type="file" accept=".csv" onChange={onFile} style={{ display: "none" }} />
        <label htmlFor="csv" style={{
          display: "inline-block", padding: "10px 20px",
          background: "var(--accent)", color: "white",
          borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 500,
        }}>
          📂 Выбрать CSV-файл
        </label>
        {filename && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
            {filename} · {rows.length} строк
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-tertiary)" }}>
          Шаблон: <code style={{ background: "var(--bg-base)", padding: "2px 6px", borderRadius: 4 }}>customer_name, customer_type, mobile_no, email_id, tax_id, website, industry, customer_details</code>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 14, background: "rgba(248,113,113,0.1)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", fontSize: 12.5 }}>
          {error}
        </div>
      )}

      {unknownHeaders.length > 0 && (
        <div style={{ padding: 12, marginBottom: 14, background: "rgba(251,191,36,0.1)", border: "1px solid var(--warning)", borderRadius: 8, color: "var(--warning)", fontSize: 12 }}>
          ⚠ Неизвестные колонки (будут проигнорированы): {unknownHeaders.join(", ")}
        </div>
      )}

      {/* Превью + кнопки */}
      {rows.length > 0 && !result && (
        <>
          <div style={{
            background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)",
            marginBottom: 20, overflow: "hidden",
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
              <b>Превью:</b> {Math.min(rows.length, 10)} из {rows.length}
            </div>
            <div style={{ overflow: "auto", maxHeight: 320 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: "var(--bg-base)" }}>
                    {headers.map((h) => (
                      <th key={h} style={{
                        padding: "8px 10px", textAlign: "left",
                        fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase",
                        letterSpacing: "0.05em", fontFamily: "monospace",
                        borderBottom: "1px solid var(--border-subtle)",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      {headers.map((h) => (
                        <td key={h} style={{ padding: "6px 10px", whiteSpace: "nowrap", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r[h] || <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => runImport(true)} disabled={importing} style={btnSecondary}>
              {importing ? "..." : "🧪 Сухой запуск (проверка)"}
            </button>
            <button onClick={() => runImport(false)} disabled={importing} style={btnPrimary}>
              {importing ? "Импорт..." : `✓ Импортировать ${rows.length} клиентов`}
            </button>
          </div>
        </>
      )}

      {/* Результат */}
      {result && (
        <div style={{
          padding: 24, borderRadius: 12,
          background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
        }}>
          <h2 style={{ fontSize: 17, margin: "0 0 14px" }}>
            {result.dry_run ? "🧪 Результат проверки" : "✓ Импорт завершён"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
            <ResStat label="Всего" value={result.total} />
            <ResStat label="Создано" value={result.created} accent="var(--success)" />
            <ResStat label="Обновлено" value={result.updated} accent="var(--accent)" />
            <ResStat label="Пропущено" value={result.skipped} accent="var(--text-tertiary)" />
          </div>

          {result.errors.length > 0 && (
            <div>
              <h4 style={{ fontSize: 13, color: "var(--danger)", margin: "12px 0 8px" }}>
                Ошибки ({result.errors.length}):
              </h4>
              <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-base)" }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>Строка</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>Имя</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>Ошибка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((er, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{er.row}</td>
                        <td style={{ padding: "6px 10px" }}>{er.name || "—"}</td>
                        <td style={{ padding: "6px 10px", color: "var(--danger)" }}>{er.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            {result.dry_run && (
              <button onClick={() => runImport(false)} disabled={importing} style={btnPrimary}>
                ✓ Запустить реальный импорт
              </button>
            )}
            <button onClick={() => { setRows([]); setResult(null); setFilename(""); }} style={btnSecondary}>
              ↩ Загрузить ещё CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "monospace", color: accent ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500,
  background: "var(--accent)", color: "white", border: "none", cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500,
  background: "var(--bg-elevated)", color: "var(--text-secondary)",
  border: "1px solid var(--border-subtle)", cursor: "pointer",
};
