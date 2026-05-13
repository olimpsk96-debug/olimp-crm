import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { tender_name } = await request.json();
  if (!tender_name) {
    return NextResponse.json({ error: "tender_name required" }, { status: 400 });
  }

  const key = process.env.FRAPPE_API_KEY;
  const secret = process.env.FRAPPE_API_SECRET;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";

  const res = await fetch(
    `${base}/api/method/olimp_construction.api.ai.tender_score.score_tender`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${key}:${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tender_name }),
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (!res.ok || data.exception) {
    return NextResponse.json(
      { error: data.exception ?? `Frappe error: ${res.status}` },
      { status: res.ok ? 500 : res.status }
    );
  }

  return NextResponse.json(data.message);
}
