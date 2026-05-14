"use client";

interface Props {
  spec: "tenders" | "projects" | "estimates" | "stock" | "certifications" | "ks2" | "worklog";
  label?: string;
}

export function ExportButton({ spec, label = "↓ Excel" }: Props) {
  return (
    <a
      href={`/api/exports?spec=${spec}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 14px", borderRadius: 10,
        border: "1px solid var(--success)", color: "var(--success)",
        background: "transparent", textDecoration: "none",
        fontSize: 13, fontWeight: 500, cursor: "pointer",
      }}
    >
      {label}
    </a>
  );
}
