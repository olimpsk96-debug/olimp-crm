import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(request: Request) {
  const body = await request.json();
  const p = new URLSearchParams();
  if (body.template_name) p.set("template_name", body.template_name);
  if (body.estimate_name) p.set("estimate_name", body.estimate_name);
  if (body.volume) p.set("volume", String(body.volume));
  if (body.markup_pct !== undefined) p.set("markup_pct", String(body.markup_pct));

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.ai.work_templates.apply_to_estimate`,
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
