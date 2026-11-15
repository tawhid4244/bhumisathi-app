"use client";

import Link from "next/link";
import { useState } from "react";
import { useLang } from "../i18n/LangProvider";

// A hands-on picture of the share ledger: dag 145, Rahim's 20 decimals. Press the steps and watch
// the second sale get blocked. (An illustration — the real thing is on /registry.)

type Step = 0 | 1 | 2 | 3;
const bn = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

export function LedgerDemo() {
  const { t, lang } = useLang();
  const [step, setStep] = useState<Step>(0);
  const num = (n: number) => (lang === "bn" ? bn(n) : String(n));
  const reserved = step >= 1 ? 10 : 0;
  const sold = step >= 3 ? 10 : 0;
  const free = 20 - reserved - sold;

  const steps = [
    { bn: "১. সালমাকে ১০ শতক বায়না", en: "1. Baina of 10 dec to Salma" },
    { bn: "২. জামালের কাছে ১৫ শতক বিক্রি?", en: "2. Sell 15 dec to Jamal?" },
    { bn: "৩. জামালের কাছে ১০ শতক বিক্রি", en: "3. Sell 10 dec to Jamal" },
  ];
  const message = [
    t("রহিমের ২০ শতক — সবটাই বিক্রয়যোগ্য।", "Rahim's 20 decimals — all sellable."),
    t(
      "বায়না নিবন্ধিত: ১০ শতক সালমার জন্য আটকে গেল।",
      "Baina registered: 10 decimals reserved for Salma.",
    ),
    t("আটকানো! বিক্রয়যোগ্য মাত্র ১০ শতক — একই জমি দুইবার বিক্রি সম্ভব নয়।", "Blocked! Only 10 decimals are sellable — the same land cannot be sold twice."), // prettier-ignore
    t(
      "বিক্রি নিবন্ধিত, নামজারি মামলা খুলল। সবাই এসএমএস পেলেন।",
      "Sale registered, mutation case opened, everyone notified by SMS.",
    ),
  ][step];

  return (
    <div className="rounded-3xl border border-line bg-card p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {t("নয়াপাড়া মৌজা · দাগ ১৪৫ · শেয়ার লেজার", "Nayapara · dag 145 · share ledger")}
        </p>
        <button
          type="button"
          onClick={() => setStep(0)}
          className="text-sm text-brand underline-offset-2 hover:underline"
        >
          {t("আবার শুরু", "Start over")}
        </button>
      </div>

      <div
        className={`mt-4 flex h-12 overflow-hidden rounded-xl ring-1 ring-line ${step === 2 ? "animate-[shake_0.4s]" : ""}`}
        role="img"
        aria-label={t(`বিক্রয়যোগ্য ${bn(free)}, বায়নায় আটকানো ${bn(reserved)}, বিক্রি ${bn(sold)} শতক`, `Sellable ${free}, reserved ${reserved}, sold ${sold} decimals`)} // prettier-ignore
      >
        {sold ? (
          <div
            className="flex items-center justify-center bg-ink text-sm font-semibold text-white transition-all duration-700"
            style={{ width: `${(sold / 20) * 100}%` }}
          >
            {t("বিক্রি", "Sold")} {num(sold)}
          </div>
        ) : null}
        {reserved ? (
          <div
            className="flex items-center justify-center bg-gold text-sm font-semibold text-ink transition-all duration-700"
            style={{ width: `${(reserved / 20) * 100}%` }}
          >
            {t("বায়না", "Baina")} {num(reserved)}
          </div>
        ) : null}
        {free ? (
          <div
            className="flex items-center justify-center bg-brand text-sm font-semibold text-white transition-all duration-700"
            style={{ width: `${(free / 20) * 100}%` }}
          >
            {t("বিক্রয়যোগ্য", "Sellable")} {num(free)}
          </div>
        ) : null}
      </div>

      <p
        aria-live="polite"
        className={`mt-3 rounded-xl p-3 text-sm font-medium transition-colors ${step === 2 ? "bg-red-50 text-verdict-red" : step === 0 ? "bg-paper" : "bg-brand-soft text-brand-deep"}`}
      >
        {message}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => {
          const n = (i + 1) as Step;
          const done = step >= n;
          return (
            <button
              key={i}
              type="button"
              disabled={step !== n - 1 && !(n === 3 && step === 2)}
              onClick={() => setStep(n)}
              className={`min-h-12 rounded-xl px-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45 ${done ? "bg-brand-soft text-brand-deep" : "bg-brand text-white hover:bg-brand-deep"}`}
            >
              {t(s.bn, s.en)}
            </button>
          );
        })}
      </div>
      <Link
        href="/registry"
        className="mt-4 inline-block text-sm font-semibold text-brand underline-offset-2 hover:underline"
      >
        {t("আসল সাব-রেজিস্ট্রি ডেমো খুলুন →", "Open the real sub-registry demo →")}
      </Link>
    </div>
  );
}
