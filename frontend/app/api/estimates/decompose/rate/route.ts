import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { feedback_id, rating, comment, was_edited } = body as {
    feedback_id?: string;
    rating?: string;
    comment?: string;
    was_edited?: number | boolean;
  };

  if (!feedback_id) return NextResponse.json({ error: "feedback_id required" }, { status: 400 });

  const params = new URLSearchParams();
  params.set("feedback_id", feedback_id);
  if (rating) params.set("rating", rating);
  if (comment) params.set("comment", comment);
  if (was_edited) params.set("was_edited", "1");

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.ai.decompose_work.rate_feedback`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      cache: "no-store",
    },
  );

  const d = await r.json();
  if (!r.ok || d.exception) {
    return NextResponse.json({ error: d.exception || `HTTP ${r.status}` }, { status: r.status });
  }
  return NextResponse.json(d.message ?? d);
}
