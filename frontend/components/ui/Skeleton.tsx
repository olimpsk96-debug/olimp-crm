"use client";

/**
 * Skeleton loader — placeholder во время загрузки данных.
 * Inline-стили чтобы не зависеть от Tailwind/CSS modules.
 */
export function Skeleton({
  height = 16,
  width = "100%",
  rounded = 6,
  style,
}: {
  height?: number | string;
  width?: number | string;
  rounded?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        height, width, borderRadius: rounded,
        background: "linear-gradient(90deg, var(--bg-elevated) 0%, rgba(255,255,255,0.04) 50%, var(--bg-elevated) 100%)",
        backgroundSize: "200% 100%",
        animation: "skeletonShimmer 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

/** Сетка из N skeleton-строк для табличных страниц. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16,
        padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-base)",
      }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={10} width="60%" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} style={{
          display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16,
          padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton key={ci} height={14} width={ci === 0 ? "85%" : "55%"} />
          ))}
        </div>
      ))}
      <style>{`
        @keyframes skeletonShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

/** KPI-grid из N карточек */
export function SkeletonKpis({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          padding: "14px 16px", borderRadius: 10,
          background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
        }}>
          <Skeleton height={10} width={60} />
          <div style={{ marginTop: 8 }}>
            <Skeleton height={22} width="70%" />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes skeletonShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
