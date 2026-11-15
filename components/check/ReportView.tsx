"use client";

import Link from "next/link";
import type { JomiReport } from "@/lib/engines/jomi-check";
import type { Severity } from "@/lib/engines/rules";
import { Bi, useLang, useNum } from "../i18n/LangProvider";
import { VerdictIcon } from "../VerdictIcon";
import { SealPanel } from "../seal/SealPanel";

// The Jomi Check report, in the visitor's language. Every text comes from the engine in both
// Bangla and English (reasons, verdict, names, land class); this view only picks one.

const SURVEY = {
  CS: { bn: "সিএস", en: "CS" },
  SA: { bn: "এসএ", en: "SA" },
  RS: { bn: "আরএস", en: "RS" },
  BS: { bn: "বিএস", en: "BS" },
} as const;

const VERDICT_STYLE = {
  red: "bg-verdict-red text-white",
  amber: "bg-verdict-amber text-white",
  green: "bg-verdict-green text-white",
} as const;

const SEVERITY_STYLE: Record<Severity, string> = {
  red: "border-verdict-red/40 bg-red-50",
  amber: "border-verdict-amber/40 bg-amber-50",
  info: "border-line bg-card",
};
const SEVERITY_LABEL: Record<Severity, { bn: string; en: string }> = {
  red: { bn: "গুরুতর", en: "Serious" },
  amber: { bn: "সতর্কতা", en: "Warning" },
  info: { bn: "তথ্য", en: "Info" },
};

const btn = "inline-flex min-h-11 items-center rounded-lg border px-3";

export function ReportView({ report }: { report: JomiReport }) {
  const { dag } = report;
  const { t, lang } = useLang();
  const num = useNum();
  const dec = (n: number) => t(`${num(n)} শতক`, `${num(n)} dec`);
  const en = lang === "en";
  const holderName = (h: { name_bn: string; name_en?: string }) => (en && h.name_en ? h.name_en : h.name_bn); // prettier-ignore

  return (
    <article aria-labelledby="verdict-title" className="space-y-6">
      {/* Verdict */}
      <section
        className={`flex items-center gap-4 rounded-2xl p-5 shadow-sm ${VERDICT_STYLE[report.verdict]}`}
        data-verdict={report.verdict}
      >
        <VerdictIcon verdict={report.verdict} className="h-12 w-12 shrink-0" />
        <div>
          <p className="text-sm opacity-90">
            {t(
              `${dag.mouza_bn} মৌজা (জেএল ${num(dag.jl_no)}), দাগ ${num(dag.dag_no)}`,
              `${dag.mouza_en} mouza (JL ${dag.jl_no}), dag ${dag.dag_no}`,
            )}
          </p>
          <h2 id="verdict-title" className="text-2xl font-bold">
            {en ? report.verdict_en : report.verdict_bn}
          </h2>
          {en ? null : (
            <p lang="en" className="text-sm opacity-90">
              {report.verdict_en}
            </p>
          )}
          <p className="mt-1 font-medium">{en ? report.advice_en : report.advice_bn}</p>
        </div>
      </section>

      {report.khatian_dags && report.khatian_dags.length > 1 ? (
        <nav aria-label={t("খতিয়ানের অন্য দাগ", "Other dags on this khatian")} className="text-sm">
          {t("এই খতিয়ানের দাগ:", "Dags on this khatian:")}{" "}
          {report.khatian_dags.map((d) => (
            <Link
              key={d}
              href={`/check?mouza=${dag.mouza_en.toLowerCase()}&by=dag&no=${d}`}
              className="mr-2 inline-flex min-h-11 items-center rounded-md px-2 text-brand underline"
            >
              {num(d)}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* Reasons */}
      <section aria-labelledby="reasons-title">
        <h3 id="reasons-title" className="text-lg font-semibold">
          <Bi bn="কারণসমূহ" en="Reasons" />
        </h3>
        <ul className="mt-2 space-y-2">
          {report.reasons.map((r, i) => (
            <li
              key={`${r.code}-${i}`}
              className={`rounded-xl border p-3 ${SEVERITY_STYLE[r.severity]}`}
              data-code={r.code}
            >
              <span className="mr-2 rounded bg-white/70 px-1.5 py-0.5 text-xs font-semibold">
                {t(SEVERITY_LABEL[r.severity].bn, SEVERITY_LABEL[r.severity].en)}
              </span>
              <span>{en ? r.en : r.bn}</span>
              {en ? null : (
                <p lang="en" className="mt-1 text-sm text-ink-soft">
                  {r.en}
                </p>
              )}
              {r.basis ? (
                <p className="mt-1 text-xs text-ink-soft">
                  {t("ভিত্তি:", "Basis:")} {r.basis}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Holders and balances */}
      <section aria-labelledby="holders-title">
        <h3 id="holders-title" className="text-lg font-semibold">
          <Bi bn="মালিক ও বিক্রয়যোগ্য অংশ" en="Holders and sellable share" />
        </h3>
        <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-paper text-ink-soft">
              <tr>
                <th scope="col" className="p-1.5 sm:p-2">
                  {t("মালিক", "Holder")}
                </th>
                <th scope="col" className="p-1.5 sm:p-2">
                  {t("রেকর্ডীয়", "Recorded")}
                </th>
                <th scope="col" className="p-1.5 sm:p-2">
                  {t("বিক্রি/বায়না/বন্ধক", "Sold/baina/mortgage")}
                </th>
                <th scope="col" className="p-1.5 sm:p-2">
                  {t("বিক্রয়যোগ্য", "Sellable")}
                </th>
              </tr>
            </thead>
            <tbody>
              {report.holders.map((h) => (
                <tr key={h.owner_id} className="border-t border-line">
                  <td className="p-1.5 sm:p-2">
                    {holderName(h)}
                    {h.is_deceased ? (
                      <span className="ml-1 text-xs text-verdict-amber">
                        {t("(মৃত)", "(deceased)")}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-1.5 sm:p-2">{dec(h.recorded_dec)}</td>
                  <td className="p-1.5 sm:p-2">
                    {num(h.sold_dec)} / {num(h.reserved_dec)} / {num(h.locked_dec)}
                  </td>
                  <td className="p-1.5 font-semibold sm:p-2" data-testid={`sellable-${h.owner_id}`}>
                    {dec(h.sellable_dec)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          {t(
            "বিক্রয়যোগ্য = রেকর্ডীয় অংশ − বিক্রি − চলমান বায়না − বন্ধক।",
            "Sellable = recorded share − sold − active bainas − mortgages.",
          )}
        </p>
      </section>

      {/* Record chain */}
      <section aria-labelledby="chain-title">
        <h3 id="chain-title" className="text-lg font-semibold">
          <Bi bn="রেকর্ডের ধারা" en="Record chain CS → SA → RS → BS" />
        </h3>
        <ol className="mt-2 grid gap-2 sm:grid-cols-4">
          {report.chain.map((c) => (
            <li
              key={c.survey}
              className="relative rounded-xl border border-line bg-card p-3 text-sm"
            >
              <p className="font-semibold text-brand">
                {t(SURVEY[c.survey].bn, SURVEY[c.survey].en)} ({num(c.year)})
              </p>
              <p>
                {t("খতিয়ান", "Khatian")} {num(c.khatian_no)}
              </p>
              <p>
                {t("দাগ", "Dag")} {num(c.survey_dag_no)}
              </p>
              <p>{dec(c.area_dec)}</p>
              <p className="mt-1 text-ink-soft">{c.owners.map(holderName).join(", ")}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Area */}
      <section className="rounded-xl border border-line bg-card p-3 text-sm">
        <p>
          {t("খতিয়ানে আয়তন:", "Area on the khatian:")} <strong>{dec(dag.recorded_area_dec)}</strong>
          {report.map_area_dec != null ? (
            <>
              {" "}
              · {t("মৌজা ম্যাপে মাপ:", "Measured on the mouza map:")}{" "}
              <strong>{dec(report.map_area_dec)}</strong>
            </>
          ) : (
            <> · {t("এই মৌজার ম্যাপ নেই", "No map for this mouza")}</>
          )}
        </p>
        <p className="mt-1 text-ink-soft">
          {t("শ্রেণি:", "Land class:")} {en ? dag.land_class_en : dag.land_class_bn} ·{" "}
          {t("লেজার সংস্করণ", "Ledger version")} {num(report.ledger_version)} ·{" "}
          {t("যাচাইয়ের তারিখ", "Checked on")} {num(report.checked_on)}
        </p>
      </section>

      {/* Next steps: the same dag carried into the other tools. */}
      <nav
        aria-label={t("এরপর কী করবেন", "What next")}
        className="rounded-xl border border-line bg-card p-3"
        data-testid="next-steps"
      >
        <p className="text-sm font-semibold">{t("এরপর কী করবেন", "What next")}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {report.map_area_dec != null ? (
            <Link
              href={`/map?mouza=${dag.mouza_en.toLowerCase()}&dag=${dag.dag_no}`}
              className={`${btn} border-brand text-brand`}
            >
              {t("ম্যাপে দেখুন", "See on the map")}
            </Link>
          ) : null}
          {report.holders.some((h) => h.is_deceased) ? (
            <Link
              href={`/warish?owner=${report.holders.find((h) => h.is_deceased)!.owner_id}`}
              className={`${btn} border-brand text-brand`}
            >
              {t("ওয়ারিশ হিসাব", "Inheritance shares")}
            </Link>
          ) : null}
          <Link
            href={`/chat?q=${encodeURIComponent(
              en
                ? `I want to know about dag ${dag.dag_no} in ${dag.mouza_en} mouza: `
                : `${dag.mouza_bn} মৌজার ${num(dag.dag_no)} নম্বর দাগ নিয়ে জানতে চাই: `,
            )}`}
            className={`${btn} border-brand text-brand`}
          >
            {t("সাথীকে জিজ্ঞাসা করুন", "Ask Sathi")}
          </Link>
          <Link href="/deed" className={`${btn} border-line`}>
            {t("দলিল যাচাই", "Check a deed")}
          </Link>
        </div>
      </nav>

      <SealPanel mouza={dag.mouza_en} dagNo={dag.dag_no} />

      <p className="rounded-xl bg-brand-soft p-3 text-sm">
        {en ? report.disclaimer_en : report.disclaimer_bn}
        {en ? null : (
          <span lang="en" className="mt-1 block text-ink-soft">
            {report.disclaimer_en}
          </span>
        )}
      </p>
    </article>
  );
}
