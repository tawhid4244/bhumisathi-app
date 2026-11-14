"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JudgeCard } from "@/lib/demo/judge";
import { VerdictIcon } from "../VerdictIcon";

// The guided tour. Each step asks the server to run ONE fixed action (/api/judge/step) and shows
// its Bangla caption and result. It moves on by itself (about 3 minutes in all) or with "পরের ধাপ".

const TOTAL = 9;
const AUTO_MS = 18_000;
const SCENARIO_BN: Record<string, string> = {
  শুরু: "শুরু",
  G1: "দুইবার বিক্রি আটকানো",
  G3: "দলিল পড়া",
  G8: "সাথী এআই",
  G2: "ওয়ারিশ",
  G7: "সিলযুক্ত রিপোর্ট",
};
const bn = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

export function JudgeTour() {
  const [cards, setCards] = useState<(JudgeCard | { error: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = cards.length >= TOTAL;

  const runStep = useCallback(async (step: number) => {
    setBusy(true);
    try {
      const res = await fetch("/api/judge/step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step }),
      });
      const json = await res.json().catch(() => null);
      setCards((c) => [...c, res.ok ? (json.card as JudgeCard) : { error: json?.error?.bn ?? "সমস্যা হয়েছে।" }]); // prettier-ignore
    } finally {
      setBusy(false);
    }
  }, []);

  const next = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!busy && cards.length < TOTAL) void runStep(cards.length);
  }, [busy, cards.length, runStep]);

  // Auto-play: after each card, wait long enough to read the caption, then continue.
  useEffect(() => {
    if (!playing || busy || done || cards.length === 0) return;
    timer.current = setTimeout(next, AUTO_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, busy, done, cards.length, next]);

  const current = cards.at(-1);

  return (
    <div className="space-y-5">
      {cards.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-4">
          <p>
            শুরু করলে ডেমোর সব তথ্য (কাল্পনিক) রিসেট হবে। প্রতিটি ধাপ প্রকৃত ইঞ্জিন চালায় — কোনো ভিডিও নয়।
          </p>
          <p lang="en" className="text-sm text-ink-soft">
            Starting resets the synthetic demo data. Every step runs the real engines.
          </p>
          <button
            type="button"
            onClick={() => {
              setPlaying(true);
              void runStep(0);
            }}
            disabled={busy}
            className="mt-3 min-h-12 rounded-lg bg-brand px-5 text-lg font-semibold text-white disabled:opacity-60"
          >
            জাজ মোড শুরু করুন
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" data-testid="judge-controls">
            <p className="mr-auto font-medium" aria-live="polite">
              ধাপ {bn(cards.length)} / {bn(TOTAL)}
              {busy ? " · চলছে…" : done ? " · শেষ" : ""}
            </p>
            {!done ? (
              <>
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="min-h-11 rounded-lg border border-line bg-card px-3"
                >
                  {playing ? "থামান" : "চালু করুন"}
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={busy}
                  className="min-h-11 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60"
                >
                  পরের ধাপ
                </button>
              </>
            ) : null}
          </div>
          <div className="h-2 overflow-hidden rounded bg-line" aria-hidden="true">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: `${(cards.length / TOTAL) * 100}%` }}
            />
          </div>
          {current ? <Card card={current} /> : null}
          {done ? (
            <p className="rounded-xl bg-brand-soft p-4 font-semibold" data-testid="judge-done">
              এক জমি, এক সত্য। ধন্যবাদ!{" "}
              <Link href="/" className="underline">
                হোমে ফিরুন
              </Link>
            </p>
          ) : null}
          {cards.length > 1 ? (
            <details>
              <summary className="cursor-pointer">আগের ধাপগুলো</summary>
              <ol className="mt-2 space-y-1 text-sm">
                {cards.slice(0, -1).map((c, i) =>
                  "error" in c ? (
                    <li key={i}>✗ {c.error}</li>
                  ) : (
                    <li key={i}>
                      {SCENARIO_BN[c.scenario]}: {c.title_bn}
                    </li>
                  ),
                )}
              </ol>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}

function Card({ card }: { card: JudgeCard | { error: string } }) {
  if ("error" in card) {
    return (
      <p role="alert" className="rounded-xl border border-verdict-amber/40 bg-amber-50 p-4">
        {card.error}
      </p>
    );
  }
  return (
    <article
      className="space-y-3 rounded-xl border border-line bg-card p-4"
      data-testid="judge-card"
      data-scenario={card.scenario}
      data-verdict={card.verdict ?? ""}
    >
      <p className="text-sm font-semibold text-brand">
        {card.scenario === "শুরু" ? "শুরু" : `${card.scenario} · ${SCENARIO_BN[card.scenario]}`}
      </p>
      <h2 className="flex items-center gap-2 text-xl font-bold">
        {card.verdict ? <VerdictIcon verdict={card.verdict} className="h-7 w-7 shrink-0" /> : null}
        {card.title_bn}
      </h2>
      <p className="text-lg" data-testid="judge-caption">
        {card.caption_bn}
      </p>
      <p lang="en" className="text-sm text-ink-soft">
        {card.caption_en}
      </p>
      {card.lines.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {card.lines.map((l, i) => (
            <li key={i} className="break-words">
              {l}
            </li>
          ))}
        </ul>
      ) : null}
      {card.qr_svg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(card.qr_svg)}`}
          alt="সিলযুক্ত রিপোর্টের QR কোড"
          width={160}
          height={160}
          className="w-40 rounded border border-line bg-white"
        />
      ) : null}
      {card.link ? (
        <Link
          href={card.link.href}
          className="inline-flex min-h-11 items-center rounded-lg border border-brand px-3 text-brand"
        >
          {card.link.label_bn}
        </Link>
      ) : null}
    </article>
  );
}
