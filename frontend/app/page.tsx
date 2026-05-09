export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        background: "var(--bg-base)",
      }}
    >
      <h1
        className="display"
        style={{
          fontSize: "48px",
          fontWeight: 300,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}
      >
        Олимп ERP
      </h1>
      <p style={{ color: "var(--text-tertiary)", fontSize: "16px" }}>
        Система запускается — Фаза 0
      </p>
      <div
        style={{
          display: "flex",
          gap: "8px",
          color: "var(--text-tertiary)",
          fontSize: "13px",
        }}
      >
        <a href="http://localhost:8080" style={{ color: "var(--accent)" }}>
          ERPNext
        </a>
        <span>·</span>
        <a href="http://localhost:5678" style={{ color: "var(--accent)" }}>
          n8n
        </a>
        <span>·</span>
        <a href="http://localhost:9001" style={{ color: "var(--accent)" }}>
          MinIO
        </a>
        <span>·</span>
        <a href="http://localhost:6333/dashboard" style={{ color: "var(--accent)" }}>
          Qdrant
        </a>
      </div>
    </div>
  );
}
