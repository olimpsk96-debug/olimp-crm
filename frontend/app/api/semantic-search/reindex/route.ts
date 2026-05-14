import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(request: Request) {
  let body: { reset?: boolean } = {};
  try { body = await request.json(); } catch { /* empty body ok */ }

  const params = new URLSearchParams();
  if (body.reset) params.set("reset", "1");

  // Эта операция может идти долго — выставляем таймаут пошире
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.semantic_search.reindex_catalog?${params}`,
    {
      method: "POST",
      headers: { Authorization: auth() },
      cache: "no-store",
      signal: AbortSignal.timeout(600_000), // 10 минут
    }
  );
  const data = await res.json();
  if (!res.ok || data.exc_type) {
    let msg = `${data.exc_type || res.status}`;
    try {
      const sm = data._server_messages ? JSON.parse(data._server_messages) : null;
      if (Array.isArray(sm) && sm[0]) {
        const inner = typeof sm[0] === "string" ? JSON.parse(sm[0]) : sm[0];
        if (inner.message) msg = String(inner.message).replace(/<[^>]+>/g, "");
      }
    } catch { /* ignore */ }
    return NextResponse.json({ error: msg }, { status: res.ok ? 500 : res.status });
  }
  return NextResponse.json(data.message ?? {});
}
