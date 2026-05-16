import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";

// GET /api/p/[token] — render proposal for public (без авторизации в Frappe)
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.proposals.render_for_public?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!r.ok) {
    return NextResponse.json({ error: "Ссылка недействительна или истекла" }, { status: 403 });
  }
  const d = await r.json();
  if (d.exception) {
    return NextResponse.json({ error: d.exception }, { status: 403 });
  }
  return NextResponse.json(d.message ?? d);
}
