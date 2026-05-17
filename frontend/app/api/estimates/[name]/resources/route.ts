import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const p = new URLSearchParams({ estimate: name });
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.estimate_grid.get_resource_breakdown?${p}`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}
