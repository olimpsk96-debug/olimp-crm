import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

// GET — список или summary или баланс проекта
// /api/site-cash?mode=summary&days=30
// /api/site-cash?mode=balance&project=PR-...
// /api/site-cash?project=PR-...&status=...&entry_type=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "list";

  let method = "olimp_construction.api.site_cash.list_entries";
  const p = new URLSearchParams();
  if (mode === "summary") {
    method = "olimp_construction.api.site_cash.get_summary";
    if (searchParams.get("days")) p.set("days", searchParams.get("days")!);
  } else if (mode === "balance") {
    method = "olimp_construction.api.site_cash.get_project_balance";
    if (searchParams.get("project")) p.set("project", searchParams.get("project")!);
    if (searchParams.get("days")) p.set("days", searchParams.get("days")!);
  } else {
    for (const k of ["project", "status", "entry_type", "days", "limit"]) {
      const v = searchParams.get(k);
      if (v) p.set(k, v);
    }
  }

  const r = await fetch(`${base}/api/method/${method}?${p}`, {
    headers: { Authorization: auth() },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}

// POST — save / confirm / reject в одном endpoint через body.action
export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action || "save";

  let method = "olimp_construction.api.site_cash.save_entry";
  if (action === "confirm") method = "olimp_construction.api.site_cash.confirm_entry";
  else if (action === "reject") method = "olimp_construction.api.site_cash.reject_entry";

  const p = new URLSearchParams();
  for (const k of ["name", "project", "entry_type", "operation_kind",
                   "amount", "date", "foreman", "counterparty",
                   "purpose", "comment", "receipt_image_url", "status",
                   "reason"]) {
    if (body[k] !== undefined && body[k] !== null) p.set(k, String(body[k]));
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

// DELETE
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const p = new URLSearchParams({ name });
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.site_cash.delete_entry`,
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
