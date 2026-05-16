/**
 * Прокси для webhook лидов с сайта.
 * Можно слать прямо на бэкенд (`/api/method/olimp_construction.api.webhook.leads.create_lead`),
 * но через Next.js удобнее: CORS контролируется здесь, а Frappe URL не светится наружу.
 */
import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";

export async function POST(request: Request) {
  let body: Record<string, string> = {};
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    body = await request.json().catch(() => ({}));
  } else {
    // form-urlencoded или multipart
    const form = await request.formData();
    form.forEach((v, k) => { body[k] = String(v); });
  }

  const params = new URLSearchParams();
  Object.entries(body).forEach(([k, v]) => { if (v) params.set(k, v); });

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.webhook.leads.create_lead`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      cache: "no-store",
    },
  );

  const data = await r.json();
  if (!r.ok || data.exception || data.exc_type) {
    return NextResponse.json(
      { error: data.exception || data.exc_type || `HTTP ${r.status}` },
      { status: r.status === 200 ? 400 : r.status },
    );
  }
  return NextResponse.json(data.message ?? data);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
