import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

// GET /api/estimates/[name]/grid → items + totals
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const p = new URLSearchParams({ estimate: name });
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.estimate_grid.get_items?${p}`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}

// POST /api/estimates/[name]/grid
// body: { action: "save_batch"|"apply_markup"|"create_proposal", ... }
export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const body = await request.json();
  const action = body.action || "save_batch";

  const methodMap: Record<string, string> = {
    save_batch: "save_items_batch",
    apply_markup: "bulk_apply_markup",
    create_proposal: "create_proposal_from_estimate",
  };
  const method = methodMap[action];
  if (!method) return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });

  const p = new URLSearchParams();
  p.set("estimate", name);

  if (action === "save_batch") {
    p.set("rows", JSON.stringify(body.rows || []));
  } else if (action === "apply_markup") {
    p.set("markup_pct", String(body.markup_pct ?? 15));
  } else if (action === "create_proposal") {
    if (body.title) p.set("title", body.title);
    if (body.template) p.set("template", body.template);
  }

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.estimate_grid.${method}`,
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
