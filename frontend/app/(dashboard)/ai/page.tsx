"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/app/api/ai/chat/route";

const SUGGESTIONS = [
  "Какие тендеры сейчас в работе?",
  "Каков прогноз кассы на следующий месяц?",
  "Есть ли открытые инциденты по ОТ/ТБ?",
  "Какие КС-2 ожидают оплаты?",
  "Подведи итог дня по прорабам",
];

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "14px 18px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--accent)",
            animation: "bounce 1.2s infinite",
            animationDelay: `${i * 0.2}s`,
            display: "inline-block",
          }}
        />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-6px);opacity:1} }`}</style>
    </div>
  );
}

function Message({ msg }: { msg: ChatMessage & { streaming?: boolean } }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 16,
    }}>
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 10, marginTop: 2 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
            <path d="M12 2a7 7 0 017 7c0 4-3 7-7 7s-7-3-7-7a7 7 0 017-7zm0 14v2m-4 2h8" />
          </svg>
        </div>
      )}
      <div style={{
        maxWidth: "72%",
        padding: "12px 16px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: isUser ? "var(--accent)" : "var(--bg-elevated)",
        border: isUser ? "none" : "1px solid var(--border-subtle)",
        color: isUser ? "white" : "var(--text-primary)",
        fontSize: 13.5,
        lineHeight: 1.65,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {msg.content || (msg.streaming ? <TypingDots /> : "")}
      </div>
    </div>
  );
}

export default function AIPage() {
  const [messages, setMessages] = useState<(ChatMessage & { streaming?: boolean })[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setInput("");

    const history: ChatMessage[] = messages
      .filter((m) => !m.streaming)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: "", streaming: true },
    ]);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.body) throw new Error("Нет ответа от сервера");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) {
              accumulated += `\n\n[Ошибка: ${parsed.error}]`;
            } else if (parsed.text) {
              accumulated += parsed.text;
            }
          } catch {
            // skip malformed chunk
          }
        }

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.streaming) {
            return [...prev.slice(0, -1), { ...last, content: accumulated }];
          }
          return prev;
        });
      }

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { role: "assistant", content: accumulated || "Нет ответа" }];
        }
        return prev;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка соединения";
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { role: "assistant", content: `Ошибка: ${msg}` }];
        }
        return prev;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-base)" }}>
      {/* Header */}
      <div style={{ padding: "18px 28px 14px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, background: "var(--bg-elevated)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
              <path d="M12 2a7 7 0 017 7c0 4-3 7-7 7s-7-3-7-7a7 7 0 017-7zm0 14v2m-4 2h8" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}>AI-ассистент</h1>
            <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 1 }}>
              Знает ваши тендеры, кассу, акты и отчёты прорабов
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer" }}>
              Новый чат
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        {isEmpty && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Добрый день, Дмитрий</p>
              <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Спросите о состоянии бизнеса — я проверю актуальные данные</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 560 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    padding: "8px 14px", borderRadius: 20, fontSize: 13,
                    border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)",
                    color: "var(--text-secondary)", cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 28px 20px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0, background: "var(--bg-elevated)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Спросите о тендерах, кассе, КС-2 или прорабах... (Enter — отправить, Shift+Enter — перенос)"
            disabled={streaming}
            rows={1}
            style={{
              flex: 1, padding: "11px 14px", borderRadius: 12,
              border: "1px solid var(--border-subtle)", background: "var(--bg-base)",
              color: "var(--text-primary)", fontSize: 13.5, outline: "none",
              resize: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
              opacity: streaming ? 0.6 : 1,
            }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            style={{
              width: 42, height: 42, borderRadius: 12, border: "none",
              background: streaming || !input.trim() ? "var(--border-subtle)" : "var(--accent)",
              color: streaming || !input.trim() ? "var(--text-tertiary)" : "white",
              cursor: streaming || !input.trim() ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "all 0.15s",
            }}>
            {streaming ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" style={{ animation: "spin 1s linear infinite" }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg);transform-origin:center}}`}</style>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 8, textAlign: "center" }}>
          Claude Haiku · Контекст обновляется при каждом запросе
        </p>
      </div>
    </div>
  );
}
