import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

// GET /api/material-consumption?project=...&status=...&days=30
// GET /api/material-consumption?mode=summary&project=...&days=30
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "list";

  const method = mode === "summary"
    ? "olimp_construction.api.material_consumption.get_summary"
    : "olimp_construction.api.material_consumption.list_consumptions";

  const p = new URLSearchParams();
  for (const k of ["project", "status", "days", "limit"]) {
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

// POST — action: save | confirm | writeoff | reject
export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action || "save";

  const methodMap: Record<string, string> = {
    save: "save_consumption",
    confirm: "confirm_consumption",
    writeoff: "writeoff_to_stock",
    reject: "reject_consumption",
  };
  const method = methodMap[action];
  if (!method) return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });

  const p = new URLSearchParams();
  for (const k of ["name", "project", "consumed_date", "foreman_name", "foreman_report",
                    "stock_item", "material_name_text", "qty", "unit", "unit_price",
                    "notes", "status", "reason"]) {
    if (body[k] !== undefined && body[k] !== null) p.set(k, String(body[k]));
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.material_consumption.${method}`,
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
    `${base}/api/method/olimp_construction.api.material_consumption.delete_consumption`,
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
