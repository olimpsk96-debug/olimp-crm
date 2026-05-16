import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "list";

  const method = mode === "summary"
    ? "olimp_construction.api.boqs.get_summary"
    : "olimp_construction.api.boqs.list_boqs";

  const p = new URLSearchParams();
  for (const k of ["status", "customer", "project", "days", "limit"]) {
    const v = searchParams.get(k);
    if (v) p.set(k, v);
  }
  const r = await fetch(`${base}/api/method/${method}?${p}`, {
    headers: { Authorization: auth() }, cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action || "create_from_estimate";

  const methodMap: Record<string, string> = {
    create_from_estimate: "create_from_estimate",
    recalculate: "recalculate_totals",
    change_status: "change_status",
  };
  const method = methodMap[action];
  if (!method) return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });

  const p = new URLSearchParams();
  for (const k of ["estimate", "title", "name", "status"]) {
    if (body[k] !== undefined && body[k] !== null) p.set(k, String(body[k]));
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.boqs.${method}`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: p, cache: "no-store",
    },
  );
  const d = await r.json();
  if (!r.ok || d.exception) {
    return NextResponse.json({ error: d.exception || `HTTP ${r.status}` }, { status: r.status });
  }
  return NextResponse.json(d.message ?? d);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const p = new URLSearchParams({ name });
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.boqs.delete_boq`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: p, cache: "no-store",
    },
  );
  const d = await r.json();
  if (!r.ok || d.exception) {
    return NextResponse.json({ error: d.exception || `HTTP ${r.status}` }, { status: r.status });
  }
  return NextResponse.json(d.message ?? d);
}
