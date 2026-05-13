import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const key = process.env.FRAPPE_API_KEY;
  const secret = process.env.FRAPPE_API_SECRET;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";

  const res = await fetch(`${base}/api/resource/Tender/${encodeURIComponent(name)}`, {
    headers: { Authorization: `token ${key}:${secret}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Frappe error: ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data.data ?? data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const key = process.env.FRAPPE_API_KEY;
  const secret = process.env.FRAPPE_API_SECRET;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
  const body = await request.json();

  // Используем set_status — обходит Workflow-переходы, разрешено директору
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.tender.set_status`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${key}:${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, status: body.status }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Frappe error: ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
