import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

// GET — list/categories/single
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "list";
  const name = searchParams.get("name");

  let method = "olimp_construction.api.assemblies.list_assemblies";
  if (mode === "categories") method = "olimp_construction.api.assemblies.get_categories";
  else if (name) method = "olimp_construction.api.assemblies.get_assembly";

  const p = new URLSearchParams();
  if (name) p.set("name", name);
  for (const k of ["category", "active_only", "search", "limit"]) {
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

// POST — save / seed / apply_to_estimate
export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action || "save";

  const methodMap: Record<string, string> = {
    save: "save_assembly",
    seed: "seed_olimp_assemblies",
    apply: "apply_to_estimate",
  };
  const method = methodMap[action];
  if (!method) return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });

  const p = new URLSearchParams();
  if (action === "save") {
    for (const k of ["name", "assembly_code", "assembly_name", "category",
                      "unit", "labor_hours", "market_rate", "description",
                      "applicable_objects", "is_active"]) {
      if (body[k] !== undefined && body[k] !== null) p.set(k, String(body[k]));
    }
    if (body.items) p.set("items", JSON.stringify(body.items));
  } else if (action === "seed") {
    p.set("force", String(body.force || 0));
  } else if (action === "apply") {
    p.set("estimate", body.estimate);
    p.set("assembly", body.assembly);
    p.set("quantity", String(body.quantity || 1));
    p.set("markup_pct", String(body.markup_pct || 15));
  }

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.assemblies.${method}`,
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
    `${base}/api/method/olimp_construction.api.assemblies.delete_assembly`,
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
