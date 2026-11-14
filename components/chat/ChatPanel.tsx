"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PendingAction, SourceRef } from "@/lib/ai/agent";
import type { ToolBadge } from "@/lib/ai/agent-request";
import type { AgentMessage } from "@/lib/ai/provider";
import { RichText } from "./RichText";
import { sectionLabel, STR, SUGGESTIONS, TOOL_LABEL, type Lang } from "./strings";

// The Sathi chat. The browser keeps the conversation history (sent back each turn) and reads
// the streamed events from /api/agent/stream: answer text, tool badges, a pending action that
// needs the citizen's Yes/No, and the final sources.

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  badges: ToolBadge[];
  sources: SourceRef[];
  pending: PendingAction | null;
  error?: string;
  streaming?: boolean;
}

const VERDICT_CHIP = {
  red: "bg-verdict-red text-white",
  amber: "bg-verdict-amber text-white",
  green: "bg-verdict-green text-white",
} as const;

let seq = 0;
const newId = () => `t${Date.now().toString(36)}${seq++}`;

export function ChatPanel() {
  const [lang, setLang] = useState<Lang>("bn");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [history, setHistory] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const t = STR[lang];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const patchLast = (fn: (turn: Turn) => Turn) =>
    setTurns((all) => (all.length ? [...all.slice(0, -1), fn(all[all.length - 1]!)] : all));

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setTurns((all) => [
      ...all,
      {
        id: newId(),
        role: "assistant",
        text: "",
        badges: [],
        sources: [],
        pending: null,
        streaming: true,
      },
    ]);
    try {
      const res = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, messages: history, lang }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.[lang] ?? t.error);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") patchLast((x) => ({ ...x, text: x.text + ev.delta }));
          else if (ev.type === "tool")
            patchLast((x) => ({ ...x, badges: [...x.badges, ev.badge] }));
          else if (ev.type === "pending") patchLast((x) => ({ ...x, pending: ev.action }));
          else if (ev.type === "error") throw new Error(ev.error?.[lang] ?? t.error);
          else if (ev.type === "done") {
            const r = ev.result;
            setHistory(r.messages);
            patchLast((x) => ({
              ...x,
              text: r.reply || x.text,
              sources: r.sources ?? [],
              pending: r.pending,
              streaming: false,
            }));
          }
        }
      }
    } catch (err) {
      patchLast((x) => ({ ...x, streaming: false, error: (err as Error).message || t.error }));
    } finally {
      setBusy(false);
    }
  }

  function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setTurns((all) => [
      ...all,
      { id: newId(), role: "user", text: q, badges: [], sources: [], pending: null },
    ]);
    void run({ message: q });
  }

  function answer(action: PendingAction, approved: boolean) {
    if (busy) return;
    // The card is answered; remove it so it cannot be pressed twice.
    setTurns((all) =>
      all.map((x) => (x.pending?.tool_use_id === action.tool_use_id ? { ...x, pending: null } : x)),
    );
    setTurns((all) => [
      ...all,
      {
        id: newId(),
        role: "user",
        text: approved ? t.yes : t.no,
        badges: [],
        sources: [],
        pending: null,
      },
    ]);
    void run({ confirm: { tool_use_id: action.tool_use_id, approved } });
  }

  function reset() {
    setTurns([]);
    setHistory([]);
  }

  const waitingForAnswer = turns.some((x) => x.pending);

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      {/* Toolbar: language + new chat */}
      <div className="flex items-center justify-between gap-2 py-3">
        <div
          role="group"
          aria-label={t.langLabel}
          className="inline-flex rounded-lg border border-line bg-card p-0.5"
        >
          {(["bn", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`min-h-10 rounded-md px-3 text-sm ${lang === l ? "bg-ink text-white" : "text-ink"}`}
            >
              {l === "bn" ? "বাংলা" : "English"}
            </button>
          ))}
        </div>
        {turns.length > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="min-h-10 rounded-lg border border-line bg-card px-3 text-sm"
          >
            {t.newChat}
          </button>
        ) : null}
      </div>

      {/* Conversation */}
      <div aria-live="polite" className="flex-1 space-y-3 pb-4" data-testid="chat-log">
        {turns.length === 0 ? (
          <section className="rounded-xl border border-line bg-card p-4">
            <p>{t.intro}</p>
            <p className="mt-3 text-sm font-medium text-ink-soft">{t.tryThese}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {SUGGESTIONS[lang].map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => ask(s)}
                    className="min-h-11 w-full rounded-lg border border-line bg-paper px-3 py-2 text-left hover:border-brand hover:bg-brand-soft"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {turns.map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-white">
                <span className="sr-only">{t.you}: </span>
                {turn.text}
              </p>
            </div>
          ) : (
            <article
              key={turn.id}
              data-role="assistant"
              className="max-w-[95%] rounded-2xl rounded-bl-sm border border-line bg-card px-3 py-2 shadow-sm"
            >
              <span className="sr-only">{t.sathi}: </span>
              {turn.badges.length > 0 ? (
                <ul className="mb-1 flex flex-wrap gap-1.5" aria-label="tools">
                  {turn.badges.map((b) => (
                    <li
                      key={b.id}
                      data-tool={b.name}
                      className={`rounded-full px-2 py-0.5 text-xs ${b.ok ? "bg-brand-soft text-brand" : "bg-amber-50 text-verdict-amber"}`}
                    >
                      {b.ok ? "✓ " : "• "}
                      {TOOL_LABEL[b.name]?.[lang] ?? b.name}
                    </li>
                  ))}
                </ul>
              ) : null}

              {turn.text ? (
                <div className="leading-relaxed">
                  <RichText text={turn.text} />
                </div>
              ) : turn.streaming ? (
                <p className="animate-pulse text-ink-soft">{t.thinking}</p>
              ) : null}

              {turn.badges
                .filter((b) => b.verdict && b.dag_no)
                .map((b) => (
                  <Link
                    key={`v${b.id}`}
                    href={`/check?mouza=${b.mouza_en?.toLowerCase()}&by=dag&no=${b.dag_no}`}
                    className={`mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${VERDICT_CHIP[b.verdict!]}`}
                    data-chat-verdict={b.verdict}
                  >
                    {b.verdict_bn} · {t.openReport} →
                  </Link>
                ))}

              {turn.sources.length > 0 ? (
                <section className="mt-2 border-t border-line pt-2 text-sm" data-testid="sources">
                  <h3 className="font-semibold">{t.sources}</h3>
                  <ul className="mt-1 space-y-1">
                    {turn.sources.map((s) => (
                      <li key={s.law_id}>
                        {s.law_bn}
                        {sectionLabel(s.section) ? `, ${sectionLabel(s.section)}` : ""}{" "}
                        <a
                          href={s.source.split(" ")[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand underline"
                        >
                          ↗
                        </a>
                        <span className="block text-xs text-ink-soft">{s.title_bn}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {turn.pending ? (
                <section
                  className="mt-3 rounded-xl border-2 border-verdict-amber bg-amber-50 p-3"
                  aria-label={t.confirmTitle}
                  data-testid="confirm-card"
                >
                  <p className="font-semibold">{t.confirmTitle}</p>
                  <p className="mt-1">{turn.pending.summary_bn}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => answer(turn.pending!, true)}
                      disabled={busy}
                      className="min-h-11 rounded-lg bg-ink px-4 font-semibold text-white disabled:opacity-60"
                    >
                      {t.yes}
                    </button>
                    <button
                      type="button"
                      onClick={() => answer(turn.pending!, false)}
                      disabled={busy}
                      className="min-h-11 rounded-lg border border-line bg-white px-4"
                    >
                      {t.no}
                    </button>
                  </div>
                </section>
              ) : null}

              {turn.error ? (
                <p role="alert" className="mt-1 text-verdict-red">
                  {turn.error}
                </p>
              ) : null}
            </article>
          ),
        )}
        <div ref={endRef} />
      </div>

      {/* Input stays at the bottom of the screen on phones */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-0 -mx-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur"
      >
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="chat-input">
            {t.placeholder}
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder={t.placeholder}
            disabled={busy || waitingForAnswer}
            className="min-h-11 flex-1 resize-none rounded-lg border border-line bg-white px-3 py-2 text-base"
          />
          <button
            type="submit"
            disabled={busy || waitingForAnswer || !input.trim()}
            className="min-h-11 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60"
          >
            {t.send}
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-soft">{t.disclaimer}</p>
      </form>
    </div>
  );
}
