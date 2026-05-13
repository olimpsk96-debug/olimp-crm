import type { Tender, TenderStatus } from "@/types/tender";
import { TenderCard } from "./TenderCard";

interface Props {
  status: TenderStatus;
  label: string;
  color: string;
  tenders: Tender[];
  totalNmck: number;
  onCardClick?: (tender: Tender) => void;
}

function formatMln(val: number): string {
  return val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)} млн` : `${(val / 1000).toFixed(0)} тыс`;
}

export function KanbanColumn({ status, label, color, tenders, totalNmck, onCardClick }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 224 }}>
      {/* Заголовок колонки */}
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: "10px 14px",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</span>
          </div>
          <span
            style={{
              fontSize: 11, fontFamily: "monospace",
              background: "var(--border-subtle)",
              padding: "2px 7px", borderRadius: 999,
              color: "var(--text-secondary)",
            }}
          >
            {tenders.length}
          </span>
        </div>
        {totalNmck > 0 && (
          <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
            {formatMln(totalNmck)}
          </p>
        )}
      </div>

      {/* Карточки */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
        {tenders.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--border-subtle)",
              borderRadius: 12, height: 80,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-tertiary)", fontSize: 12,
            }}
          >
            Нет тендеров
          </div>
        ) : (
          tenders.map((t) => (
            <TenderCard key={t.name} tender={t} onClick={() => onCardClick?.(t)} />
          ))
        )}
      </div>
    </div>
  );
}
