import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const p = new URLSearchParams();
  for (const k of ["project", "days"]) {
    const v = searchParams.get(k);
    if (v) p.set(k, v);
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.inspections.get_runs?${p}`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  // submit_answers
  const p = new URLSearchParams();
  if (body.run_id) p.set("run_id", body.run_id);
  if (body.answers) p.set("answers", JSON.stringify(body.answers));
  if (body.finish !== undefined) p.set("finish", String(body.finish));
  if (body.notes) p.set("notes", body.notes);

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.inspections.submit_answers`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: p, cache: "no-store",
    },
  );
  const d = await r.json();
  if (!r.ok || d.exception) return NextResponse.json({ error: d.exception }, { status: r.status });
  return NextResponse.json(d.message ?? d);
}
