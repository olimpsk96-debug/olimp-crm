"use client";

/**
 * EmptyState — пустая страница / список с CTA-кнопкой.
 * Используется когда нет данных, но это нормально.
 */
export function EmptyState({
  icon = "📭",
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div style={{
      padding: "48px 40px", textAlign: "center",
      background: "var(--bg-elevated)", borderRadius: 14,
      border: "1px dashed var(--border-subtle)",
    }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 6px" }}>{title}</h3>
      {description && (
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 auto 16px", maxWidth: 460 }}>
          {description}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
        {actionLabel && onAction && (
          <button onClick={onAction} style={{
            padding: "10px 22px", borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: "var(--accent)", color: "white", border: "none", cursor: "pointer",
          }}>
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button onClick={onSecondary} style={{
            padding: "10px 22px", borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)", cursor: "pointer",
          }}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
