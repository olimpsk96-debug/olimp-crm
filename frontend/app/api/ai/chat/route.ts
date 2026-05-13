import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";
const frappeAuth = () =>
  `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function fetchContext(): Promise<string> {
  const headers = { Authorization: frappeAuth() };
  const fetch_ = (url: string) =>
    fetch(url, { headers, cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);

  const [tenders, cashflow, ks2, incidents, reports] = await Promise.all([
    fetch_(`${base}/api/method/olimp_construction.api.tender.get_pipeline`),
    fetch_(`${base}/api/method/olimp_construction.api.cashflow.get_dashboard`),
    fetch_(`${base}/api/method/olimp_construction.api.ks2.get_list`),
    fetch_(`${base}/api/method/olimp_construction.api.foreman.get_incidents?status=Открыт`),
    fetch_(`${base}/api/method/olimp_construction.api.foreman.get_reports?limit=5`),
  ]);

  const fmtRub = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)} млн ₽` : `${(v / 1000).toFixed(0)} тыс. ₽`;

  const lines: string[] = ["=== АКТУАЛЬНЫЕ ДАННЫЕ ОЛИМП (обновлено сейчас) ===\n"];

  // Cashflow
  if (cashflow?.message) {
    const cf = cashflow.message;
    lines.push(
      `КАССА: баланс ${fmtRub(cf.current_balance)}, ожидается ${fmtRub(cf.total_incoming)}, расходы ${fmtRub(cf.total_outgoing)}, прогноз ${fmtRub(cf.projected_balance)}`
    );
    if (cf.incoming?.length) {
      lines.push(`  Поступления: ${cf.incoming.map((i: { title: string; amount: number; due_date?: string }) => `${i.title} — ${fmtRub(i.amount)}${i.due_date ? ` (до ${i.due_date})` : ""}`).join("; ")}`);
    }
    if (cf.outgoing?.length) {
      lines.push(`  Расходы: ${cf.outgoing.map((o: { title: string; amount: number; due_date?: string }) => `${o.title} — ${fmtRub(o.amount)}${o.due_date ? ` (до ${o.due_date})` : ""}`).join("; ")}`);
    }
  }

  // Tenders by column
  if (tenders?.message?.columns) {
    const cols: Array<{ label: string; cards?: Array<{ title?: string; name: string; nmck?: number }> }> = tenders.message.columns;
    const active = cols.flatMap((c) =>
      (c.cards ?? []).map((t) => `${t.title ?? t.name} [${c.label}]${t.nmck ? ` НМЦК ${fmtRub(t.nmck)}` : ""}`)
    );
    if (active.length) lines.push(`\nТЕНДЕРЫ (${active.length}): ${active.join("; ")}`);
  }

  // KS2
  if (ks2?.message?.length) {
    const acts: Array<{ title: string; status: string; amount?: number; payment_status?: string }> = ks2.message;
    lines.push(`\nАКТЫ КС-2 (${acts.length}): ${acts.map((a) => `${a.title} — ${a.status}${a.amount ? ` ${fmtRub(a.amount)}` : ""}${a.payment_status ? ` [${a.payment_status}]` : ""}`).join("; ")}`);
  }

  // Safety incidents
  if (incidents?.message?.length) {
    const inc: Array<{ title: string; severity: string }> = incidents.message;
    lines.push(`\nОТКРЫТЫЕ ИНЦИДЕНТЫ ОТ/ТБ (${inc.length}): ${inc.map((i) => `${i.title} (${i.severity})`).join("; ")}`);
  }

  // Foreman reports
  if (reports?.message?.length) {
    const rep: Array<{ foreman_name?: string; report_date: string; workers_count?: number }> = reports.message;
    lines.push(`\nПОСЛЕДНИЕ ОТЧЁТЫ ПРОРАБОВ: ${rep.map((r) => `${r.foreman_name ?? "—"} ${r.report_date}${r.workers_count ? ` (${r.workers_count} чел)` : ""}`).join("; ")}`);
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `Ты — AI-ассистент для директора строительной компании ООО «Олимп» (Екатеринбург).

Компания занимается промышленным строительством и антикоррозийной защитой (АКЗ), участвует в тендерах по 44-ФЗ и 223-ФЗ.

Твои задачи:
- Отвечать на вопросы о тендерах, сметах, КС-2 актах, снабжении, денежном потоке и безопасности
- Анализировать актуальные данные компании (см. контекст ниже)
- Давать конкретные практические советы

Правила ответов:
- Отвечай только по-русски
- Будь конкретен — называй суммы, имена, сроки из данных
- Если данных недостаточно — честно скажи об этом
- Форматируй числа читаемо (1,5 млн ₽, не 1500000)
- Держи ответы краткими и по делу — директор занят
- Если вопрос о действии — предложи конкретный следующий шаг`;

export async function POST(request: Request) {
  const { message, history = [] } = (await request.json()) as {
    message: string;
    history: ChatMessage[];
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Пустой запрос" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
  }

  let contextBlock = "";
  try {
    contextBlock = await fetchContext();
  } catch {
    contextBlock = "(данные временно недоступны)";
  }

  const client = new Anthropic({ apiKey });

  const systemWithContext = `${SYSTEM_PROMPT}\n\n${contextBlock}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemWithContext,
          messages,
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const data = JSON.stringify({ text: chunk.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ошибка Claude API";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
