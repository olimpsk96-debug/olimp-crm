import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const p = new URLSearchParams();
  for (const k of ["search", "category_type", "department_name", "row_type", "is_abstract", "limit", "offset"]) {
    const v = searchParams.get(k);
    if (v !== null && v !== "") p.set(k, v);
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.ai.work_items_search.get_list?${p}`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? {});
}
