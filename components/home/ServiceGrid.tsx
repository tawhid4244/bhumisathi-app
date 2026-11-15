"use client";

import Link from "next/link";
import { useState } from "react";
import { useLang } from "../i18n/LangProvider";
import { IconArrow } from "../ui/icons";
import { SERVICES, type Audience } from "../site/services";

// "Land services" grid with tabs, like the government portals: coloured top bar, icon, title.
const TABS: { key: "all" | Audience; bn: string; en: string }[] = [
  { key: "all", bn: "সকল সেবা", en: "All services" },
  { key: "citizen", bn: "নাগরিক সেবা", en: "For citizens" },
  { key: "office", bn: "দপ্তর সেবা", en: "For offices" },
];

export function ServiceGrid() {
  const { t } = useLang();
  const [tab, setTab] = useState<"all" | Audience>("all");
  const list = SERVICES.filter((s) => tab === "all" || s.audience === tab);
  return (
    <div data-testid="services">
      <div
        role="tablist"
        aria-label={t("সেবার ধরন", "Service type")}
        className="flex flex-wrap justify-center gap-2"
      >
        {TABS.map((x) => (
          <button
            key={x.key}
            role="tab"
            type="button"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${tab === x.key ? "bg-brand text-white shadow" : "bg-card text-brand-deep ring-1 ring-line hover:bg-brand-soft"}`}
          >
            {t(x.bn, x.en)}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6">
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {list.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="lift group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card text-center"
              >
                <span className={`h-1.5 ${s.bar}`} aria-hidden="true" />
                <span className="flex flex-1 flex-col items-center gap-2 p-4">
                  <span
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${s.tint}`}
                  >
                    <s.Icon className="h-6 w-6" />
                  </span>
                  <span className="font-semibold leading-snug">{t(s.bn, s.en)}</span>
                  <span className="text-xs leading-snug text-ink-soft">
                    {t(s.hintBn, s.hintEn)}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-brand opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {t("খুলুন", "Open")} <IconArrow className="h-3.5 w-3.5" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
