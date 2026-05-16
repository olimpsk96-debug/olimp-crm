import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(request: Request) {
  const body = await request.json();
  const p = new URLSearchParams();
  for (const k of ["rate_code", "estimate_name", "qty", "base_unit_price", "our_unit_price"]) {
    const v = body[k];
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.ai.work_items_search.add_to_estimate`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: p,
      cache: "no-store",
    },
  );
  const d = await r.json();
  if (!r.ok || d.exception) {
    return NextResponse.json({ error: d.exception || `HTTP ${r.status}` }, { status: r.status });
  }
  return NextResponse.json(d.message ?? d);
}
