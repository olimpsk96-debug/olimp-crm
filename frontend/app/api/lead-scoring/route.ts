import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET() {
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.lead_scoring.get_grades_summary`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? {});
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const url = body.name
    ? `${base}/api/method/olimp_construction.api.lead_scoring.score_deal`
    : `${base}/api/method/olimp_construction.api.lead_scoring.score_all_deals`;
  const p = new URLSearchParams();
  if (body.name) p.set("name", body.name);

  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: p, cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok || d.exception) return NextResponse.json({ error: d.exception }, { status: r.status });
  return NextResponse.json(d.message ?? d);
}
