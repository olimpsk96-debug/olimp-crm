import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(request: Request) {
  const body = await request.json();
  const p = new URLSearchParams();
  if (body.rate_code) p.set("rate_code", body.rate_code);
  if (body.template_id) p.set("template_id", body.template_id);
  if (body.keywords) p.set("keywords", body.keywords);

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.ai.work_items_search.convert_to_work_template`,
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
