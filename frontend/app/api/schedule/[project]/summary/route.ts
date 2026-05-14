import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(_: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.schedule.get_summary?project=${encodeURIComponent(project)}`,
    { headers: { Authorization: auth() }, cache: "no-store" }
  );
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
