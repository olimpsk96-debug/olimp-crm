import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

// GET /api/proposals/[name]
// GET /api/proposals/[name]?mode=merge_data
export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "get";

  const method = mode === "merge_data"
    ? "olimp_construction.api.proposals.get_merge_data"
    : "olimp_construction.api.proposals.get_proposal";

  const p = new URLSearchParams({ name });
  const r = await fetch(`${base}/api/method/${method}?${p}`, {
    headers: { Authorization: auth() },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}
