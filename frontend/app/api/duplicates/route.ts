import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

// GET /api/duplicates?doctype=...&text=...&project=...&threshold=70&limit=5
// GET /api/duplicates?global=1&text=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isGlobal = searchParams.get("global") === "1";

  const method = isGlobal
    ? "olimp_construction.api.duplicates.find_similar_global"
    : "olimp_construction.api.duplicates.find_similar";

  const p = new URLSearchParams();
  for (const k of ["doctype", "text", "project", "threshold", "limit", "limit_per_type"]) {
    const v = searchParams.get(k);
    if (v) p.set(k, v);
  }
  const r = await fetch(`${base}/api/method/${method}?${p}`, {
    headers: { Authorization: auth() },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}
