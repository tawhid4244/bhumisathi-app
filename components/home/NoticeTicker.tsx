"use client";

import { useState } from "react";
import { useLang } from "../i18n/LangProvider";

// A portal-style scrolling notice bar. Pause button for people who want to read (WCAG 2.2.2).
const NOTICES: [string, string][] = [
  [
    "জমি কেনার আগে দাগ নম্বর দিয়ে যাচাই করুন — লাল, হলুদ বা সবুজ রিপোর্ট সঙ্গে সঙ্গে।",
    "Check the dag number before you buy — a red, amber or green report at once.",
  ],
  [
    "নামজারি ফি মাত্র ১,১৭০ টাকা (২০ + ৫০ + ১,১০০) — দালালকে বেশি দেবেন না।",
    "Mutation fee is only Tk 1,170 (20 + 50 + 1,100) — do not pay a broker more.",
  ],
  [
    "বায়না নিবন্ধিত হলে ওই অংশ আর কারো কাছে বিক্রি করা যায় না।",
    "Once a baina is registered, that share cannot be sold to anyone else.",
  ],
  [
    "সিলযুক্ত রিপোর্টের QR স্ক্যান করে যাচাই করুন — আসল ও হালনাগাদ কি না।",
    "Scan a sealed report's QR to see if it is genuine and current.",
  ],
  ["ভূমিসেবা সহায়তা: ১৬১২২ (সকাল ৯টা – বিকেল ৫টা)।", "Land service help: 16122."],
];

export function NoticeTicker() {
  const { t } = useLang();
  const [paused, setPaused] = useState(false);
  const items = NOTICES.map(([bn, en]) => t(bn, en));
  return (
    <div className="border-y border-line bg-card">
      <div className="mx-auto flex max-w-6xl items-stretch">
        <p className="flex shrink-0 items-center bg-accent px-3 text-sm font-semibold text-white">
          {t("নোটিশ", "Notice")}
        </p>
        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          aria-label={t("নোটিশ", "Notices")}
          role="region"
        >
          <ul className={`flex w-max gap-10 py-2 pl-4 text-sm ${paused ? "" : "animate-marquee"}`}>
            {[...items, ...items].map((n, i) => (
              <li key={i} aria-hidden={i >= items.length} className="whitespace-nowrap">
                <span className="mr-2 text-accent" aria-hidden="true">
                  ●
                </span>
                {n}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="shrink-0 border-l border-line px-3 text-sm text-brand-deep hover:bg-brand-soft"
          aria-pressed={paused}
        >
          {paused ? t("চালু", "Play") : t("থামান", "Pause")}
        </button>
      </div>
    </div>
  );
}
