"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JudgeCard } from "@/lib/demo/judge";
import { useLang, useNum } from "../i18n/LangProvider";
import { VerdictIcon } from "../VerdictIcon";

// The guided tour. Each step asks the server to run ONE fixed action (/api/judge/step) and shows
// its caption and result in the visitor's language. It moves on by itself (about 3 minutes in
// all) or with the "next step" button.

const TOTAL = 9;
const AUTO_MS = 18_000;
const SCENARIO: Record<string, { bn: string; en: string }> = {
  শুরু: { bn: "শুরু", en: "Start" },
  G1: { bn: "দুইবার বিক্রি আটকানো", en: "Double sale blocked" },
  G3: { bn: "দলিল পড়া", en: "Deed reading" },
  G8: { bn: "সাথী এআই", en: "Sathi AI" },
  G2: { bn: "ওয়ারিশ", en: "Inheritance" },
  G7: { bn: "সিলযুক্ত রিপোর্ট", en: "Sealed report" },
};

type Failed = { error: { bn: string; en: string } };

export function JudgeTour() {
  const { t, lang } = useLang();
  const num = useNum();
  const [cards, setCards] = useState<(JudgeCard | Failed)[]>([]);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = cards.length >= TOTAL;
  const scenarioName = (s: string) => t(SCENARIO[s]?.bn ?? s, SCENARIO[s]?.en ?? s);

  const runStep = useCallback(
    async (step: number) => {
      setBusy(true);
      try {
        const res = await fetch("/api/judge/step", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ step, lang }),
        });
        const json = await res.json().catch(() => null);
        setCards((c) => [
          ...c,
          res.ok
            ? (json.card as JudgeCard)
            : {
                error: {
                  bn: json?.error?.bn ?? "সমস্যা হয়েছে।",
                  en: json?.error?.en ?? "Something went wrong.",
                },
              },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [lang],
  );

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
            {t(
              "শুরু করলে ডেমোর সব তথ্য (কাল্পনিক) রিসেট হবে। প্রতিটি ধাপ প্রকৃত ইঞ্জিন চালায় — কোনো ভিডিও নয়।",
              "Starting resets the synthetic demo data. Every step runs the real engines — it is not a video.",
            )}
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
            {t("জাজ মোড শুরু করুন", "Start judge mode")}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" data-testid="judge-controls">
            <p className="mr-auto font-medium" aria-live="polite">
              {t("ধাপ", "Step")} {num(cards.length)} / {num(TOTAL)}
              {busy ? t(" · চলছে…", " · running…") : done ? t(" · শেষ", " · done") : ""}
            </p>
            {!done ? (
              <>
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="min-h-11 rounded-lg border border-line bg-card px-3"
                >
                  {playing ? t("থামান", "Pause") : t("চালু করুন", "Play")}
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={busy}
                  className="min-h-11 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60"
                >
                  {t("পরের ধাপ", "Next step")}
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
          {current ? <Card card={current} scenarioName={scenarioName} /> : null}
          {done ? (
            <p className="rounded-xl bg-brand-soft p-4 font-semibold" data-testid="judge-done">
              {t("এক জমি, এক সত্য। ধন্যবাদ!", "One plot, one truth. Thank you!")}{" "}
              <Link href="/" className="underline">
                {t("হোমে ফিরুন", "Back to home")}
              </Link>
            </p>
          ) : null}
          {cards.length > 1 ? (
            <details>
              <summary className="cursor-pointer">{t("আগের ধাপগুলো", "Earlier steps")}</summary>
              <ol className="mt-2 space-y-1 text-sm">
                {cards.slice(0, -1).map((c, i) =>
                  "error" in c ? (
                    <li key={i}>✗ {t(c.error.bn, c.error.en)}</li>
                  ) : (
                    <li key={i}>
                      {scenarioName(c.scenario)}: {t(c.title_bn, c.title_en)}
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

function Card({
  card,
  scenarioName,
}: {
  card: JudgeCard | Failed;
  scenarioName: (s: string) => string;
}) {
  const { t, lang } = useLang();
  const en = lang === "en";
  if ("error" in card) {
    return (
      <p role="alert" className="rounded-xl border border-verdict-amber/40 bg-amber-50 p-4">
        {t(card.error.bn, card.error.en)}
      </p>
    );
  }
  const lines = en ? card.lines_en : card.lines;
  return (
    <article
      className="space-y-3 rounded-xl border border-line bg-card p-4"
      data-testid="judge-card"
      data-scenario={card.scenario}
      data-verdict={card.verdict ?? ""}
    >
      <p className="text-sm font-semibold text-brand">
        {card.scenario === "শুরু"
          ? scenarioName("শুরু")
          : `${card.scenario} · ${scenarioName(card.scenario)}`}
      </p>
      <h2 className="flex items-center gap-2 text-xl font-bold">
        {card.verdict ? <VerdictIcon verdict={card.verdict} className="h-7 w-7 shrink-0" /> : null}
        {en ? card.title_en : card.title_bn}
      </h2>
      <p className="text-lg" data-testid="judge-caption">
        {en ? card.caption_en : card.caption_bn}
      </p>
      {en ? null : (
        <p lang="en" className="text-sm text-ink-soft">
          {card.caption_en}
        </p>
      )}
      {lines.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {lines.map((l, i) => (
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
          alt={t("সিলযুক্ত রিপোর্টের QR কোড", "QR code of the sealed report")}
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
          {en ? card.link.label_en : card.link.label_bn}
        </Link>
      ) : null}
    </article>
  );
}
