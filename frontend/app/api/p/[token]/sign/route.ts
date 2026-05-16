import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json();

  const p = new URLSearchParams();
  p.set("token", token);
  if (body.signer_name) p.set("signer_name", body.signer_name);
  if (body.signature_data_url) p.set("signature_data_url", body.signature_data_url);

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.proposals.submit_signature`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: p, cache: "no-store",
    },
  );
  const d = await r.json();
  if (!r.ok || d.exception) {
    return NextResponse.json({ error: d.exception || `HTTP ${r.status}` }, { status: r.status });
  }
  return NextResponse.json(d.message ?? d);
}
