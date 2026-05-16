import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export const runtime = "nodejs";

// GET /api/proposals/[name]/export?format=pdf|docx
export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "pdf";

  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ error: "format must be pdf or docx" }, { status: 400 });
  }

  const method = format === "pdf"
    ? "olimp_construction.api.proposals_export.export_pdf"
    : "olimp_construction.api.proposals_export.export_docx";

  const r = await fetch(
    `${base}/api/method/${method}?name=${encodeURIComponent(name)}`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) {
    return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  }

  const blob = await r.arrayBuffer();
  const contentType = format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const filename = `${name.replace(/\//g, "-")}.${format}`;

  return new NextResponse(blob, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
