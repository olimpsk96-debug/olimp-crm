import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

// GET /api/proposals?status=...&customer=...&days=365
// GET /api/proposals?mode=summary
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "list";

  const method = mode === "summary"
    ? "olimp_construction.api.proposals.get_summary"
    : "olimp_construction.api.proposals.list_proposals";

  const p = new URLSearchParams();
  for (const k of ["status", "customer", "project", "days", "limit"]) {
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

// POST — action: save | generate_token | mark_sent
export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action || "save";

  const methodMap: Record<string, string> = {
    save: "save_proposal",
    generate_token: "generate_share_token",
    mark_sent: "mark_sent",
  };
  const method = methodMap[action];
  if (!method) return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });

  const p = new URLSearchParams();
  for (const k of ["name", "title", "customer", "project", "estimate_link",
                    "template_used", "status", "total_amount", "valid_until",
                    "content_json", "notes", "ttl_days"]) {
    if (body[k] !== undefined && body[k] !== null) p.set(k, String(body[k]));
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.proposals.${method}`,
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
    `${base}/api/method/olimp_construction.api.proposals.delete_proposal`,
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
