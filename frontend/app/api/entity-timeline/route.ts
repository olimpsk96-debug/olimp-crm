import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctype = searchParams.get("doctype");
  const name = searchParams.get("name");
  if (!doctype || !name) return NextResponse.json({ error: "doctype, name required" }, { status: 400 });
  const limit = searchParams.get("limit") ?? "50";
  const url = `${base}/api/method/olimp_construction.api.entity_timeline.get_timeline?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(name)}&limit=${limit}`;
  const r = await fetch(url, { headers: { Authorization: auth() }, cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.doctype || !body.name || !body.content) {
    return NextResponse.json({ error: "doctype, name, content required" }, { status: 400 });
  }
  const p = new URLSearchParams();
  p.set("doctype", body.doctype);
  p.set("name", body.name);
  p.set("content", body.content);
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.entity_timeline.add_comment`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: p, cache: "no-store",
    },
  );
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}
