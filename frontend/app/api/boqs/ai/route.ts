import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export const runtime = "nodejs";
export const maxDuration = 60; // Claude может думать 20-40 сек

export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action || "generate";

  const methodMap: Record<string, string> = {
    generate: "olimp_construction.api.ai.boq_advisor.generate_boq",
    save: "olimp_construction.api.ai.boq_advisor.save_generated_boq",
  };
  const method = methodMap[action];
  if (!method) return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });

  const p = new URLSearchParams();
  if (action === "generate") {
    if (body.description) p.set("description", body.description);
    if (body.project) p.set("project", body.project);
    if (body.customer) p.set("customer", body.customer);
    if (body.region) p.set("region", body.region);
  } else if (action === "save") {
    for (const k of ["title", "summary", "project", "customer",
                      "overhead_percent", "profit_percent",
                      "contingency_percent", "vat_percent"]) {
      if (body[k] !== undefined && body[k] !== null) p.set(k, String(body[k]));
    }
    if (body.sections) p.set("sections", JSON.stringify(body.sections));
    if (body.positions) p.set("positions", JSON.stringify(body.positions));
  }

  const r = await fetch(`${base}/api/method/${method}`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: p, cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok || d.exception) {
    return NextResponse.json({ error: d.exception || `HTTP ${r.status}` }, { status: r.status });
  }
  return NextResponse.json(d.message ?? d);
}
