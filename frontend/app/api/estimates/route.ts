import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => {
  const key = process.env.FRAPPE_API_KEY;
  const secret = process.env.FRAPPE_API_SECRET;
  return `token ${key}:${secret}`;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project") ?? "";
  const tender = searchParams.get("tender") ?? "";

  const params = new URLSearchParams();
  if (project) params.set("project", project);
  if (tender) params.set("tender", tender);

  const url = `${base}/api/method/olimp_construction.api.estimate.get_list?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: auth() },
    cache: "no-store",
  });

  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${base}/api/method/olimp_construction.api.estimate.save_estimate`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ data: body }),
    cache: "no-store",
  });

  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
