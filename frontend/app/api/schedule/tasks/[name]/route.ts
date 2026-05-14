import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const body = await request.json();
  const res = await fetch(`${base}/api/method/olimp_construction.api.schedule.save_task`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ data: { ...body, name } }),
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}

export async function DELETE(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.schedule.delete_task?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: { Authorization: auth() },
      cache: "no-store",
    }
  );
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}

export async function PATCH(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const body = await request.json();
  // Универсально: либо {progress: X}, либо {start_date, end_date}
  let endpoint: string;
  let payload: Record<string, unknown>;
  if (body.progress !== undefined) {
    endpoint = "set_progress";
    payload = { name, progress: body.progress };
  } else if (body.start_date !== undefined || body.end_date !== undefined) {
    endpoint = "set_dates";
    payload = { name };
    if (body.start_date !== undefined) payload.start_date = body.start_date;
    if (body.end_date !== undefined) payload.end_date = body.end_date;
  } else {
    return NextResponse.json({ error: "Unknown PATCH body" }, { status: 400 });
  }
  const res = await fetch(`${base}/api/method/olimp_construction.api.schedule.${endpoint}`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
