"use client";

import Link from "next/link";
import type { FeeService } from "@/lib/engines/fees";
import { useLang, useNum } from "../i18n/LangProvider";

// Official fees, line by line, in the visitor's language. Data: content/fees.json (sourced).
export function FeeList({ services, note }: { services: FeeService[]; note: string }) {
  const { t, lang } = useLang();
  const en = lang === "en";
  const num = useNum();
  const tk = (n: number) => (en ? `Tk ${n.toLocaleString("en-IN")}` : `${num(n.toLocaleString("en-IN"))} টাকা`); // prettier-ignore
  return (
    <>
      <p className="rounded-xl bg-amber-50 p-3 text-sm">
        {t(
          "এখানে না থাকা কোনো টাকা সরকারি ফি নয়। বাড়তি টাকা চাইলে ১৬১২২-এ জানান। ফি বদলাতে পারে — এসি ল্যান্ড অফিস বা land.gov.bd-তে মিলিয়ে নিন।",
          "Any money not listed here is not an official fee. If someone asks for more, report it to 16122. Fees can change — confirm at the AC Land office or land.gov.bd.",
        )}
        {en ? null : (
          <span lang="en" className="mt-1 block text-xs text-ink-soft">
            {note}
          </span>
        )}
      </p>
      {services.map((s) => (
        <section
          key={s.id}
          id={s.id}
          className="rounded-xl border border-line bg-card p-4"
          data-service={s.id}
        >
          <h2 className="text-lg font-semibold">
            {en ? s.en : s.bn}{" "}
            {en ? null : (
              <span lang="en" className="text-sm font-normal text-ink-soft">
                {s.en}
              </span>
            )}
          </h2>
          {s.items.length ? (
            <table className="mt-2 w-full text-left text-sm">
              <tbody>
                {s.items.map((i) => (
                  <tr key={i.en} className="border-t border-line">
                    <td className="py-1.5 pr-2">
                      {en ? i.en : i.bn}
                      <span className="block text-xs text-ink-soft">
                        {en ? i.when_en : i.when_bn}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-semibold">{tk(i.tk)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-ink">
                  <td className="py-1.5 font-semibold">{t("মোট", "Total")}</td>
                  <td className="py-1.5 text-right text-lg font-bold" data-testid={`total-${s.id}`}>
                    {tk(s.total_tk!)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : s.components_bn ? (
            <div className="mt-2 text-sm">
              <p>
                {t(
                  "খরচের অংশ (হার জমির মূল্য ও এলাকা অনুযায়ী, প্রতি বছর বদলায়):",
                  "Parts of the cost (rates depend on land value and area, and change every year):",
                )}
              </p>
              <ul className="mt-1 list-disc pl-5">
                {(en ? (s.components_en ?? s.components_bn) : s.components_bn).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-2 text-sm">
            {t("সময়:", "Time:")} {en ? s.time_en : s.time_bn}
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            {t("সূত্র:", "Source:")} {s.source}
            <span className="block">
              {t("যাচাই:", "Verified:")} {s.verified}
            </span>
          </p>
          {s.law_id ? (
            <Link href="/chat" className="mt-2 inline-block text-sm text-brand underline">
              {t("এ নিয়ে সাথী এআই-কে জিজ্ঞাসা করুন →", "Ask Sathi AI about this →")}
            </Link>
          ) : null}
        </section>
      ))}
    </>
  );
}
