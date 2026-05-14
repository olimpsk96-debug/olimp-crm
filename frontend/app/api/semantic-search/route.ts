import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  for (const k of ["query", "limit", "category", "resource_type"]) {
    const v = searchParams.get(k);
    if (v) params.set(k, v);
  }
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.semantic_search.search?${params}`,
    { headers: { Authorization: auth() }, cache: "no-store" }
  );
  const data = await res.json();
  if (!res.ok || data.exc_type) {
    // Извлекаем понятное сообщение из Frappe _server_messages
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
  return NextResponse.json(data.message ?? []);
}
