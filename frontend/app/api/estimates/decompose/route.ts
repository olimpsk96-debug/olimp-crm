import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { description, volume, estimate_name } = body as {
    description?: string;
    volume?: number;
    estimate_name?: string;
  };

  if (!description) {
    return NextResponse.json({ error: "Опиши работу" }, { status: 400 });
  }

  const params = new URLSearchParams();
  params.set("description", description);
  if (volume) params.set("volume", String(volume));
  if (estimate_name) params.set("estimate_name", estimate_name);

  const url = `${base}/api/method/olimp_construction.api.ai.decompose_work.decompose_work`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok || data.exception || data.exc_type) {
    return NextResponse.json(
      { error: data.exception || data.exc_type || `HTTP ${res.status}` },
      { status: res.status },
    );
  }
  return NextResponse.json(data.message ?? data);
}
