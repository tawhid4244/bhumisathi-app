import Link from "next/link";
import type { JomiReport } from "@/lib/engines/jomi-check";
import { bn, type Severity } from "@/lib/engines/rules";
import { VerdictIcon } from "../VerdictIcon";
import { SealPanel } from "../seal/SealPanel";

const SURVEY_BN = { CS: "সিএস", SA: "এসএ", RS: "আরএস", BS: "বিএস" } as const;

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
const SEVERITY_LABEL: Record<Severity, string> = { red: "গুরুতর", amber: "সতর্কতা", info: "তথ্য" };

const dec = (n: number) => `${bn(n)} শতক`;

export function ReportView({ report }: { report: JomiReport }) {
  const { dag } = report;
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
            {dag.mouza_bn} মৌজা (জেএল {bn(dag.jl_no)}), দাগ {bn(dag.dag_no)}
          </p>
          <h2 id="verdict-title" className="text-2xl font-bold">
            {report.verdict_bn}
          </h2>
          <p lang="en" className="text-sm opacity-90">
            {report.verdict_en}
          </p>
          <p className="mt-1 font-medium">{report.advice_bn}</p>
        </div>
      </section>

      {report.khatian_dags && report.khatian_dags.length > 1 ? (
        <nav aria-label="খতিয়ানের অন্য দাগ" className="text-sm">
          এই খতিয়ানের দাগ:{" "}
          {report.khatian_dags.map((d) => (
            <Link
              key={d}
              href={`/check?mouza=${dag.mouza_en.toLowerCase()}&by=dag&no=${d}`}
              className="mr-2 inline-flex min-h-11 items-center rounded-md px-2 text-brand underline"
            >
              {bn(d)}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* Reasons */}
      <section aria-labelledby="reasons-title">
        <h3 id="reasons-title" className="text-lg font-semibold">
          কারণসমূহ{" "}
          <span lang="en" className="text-sm font-normal text-ink-soft">
            Reasons
          </span>
        </h3>
        <ul className="mt-2 space-y-2">
          {report.reasons.map((r, i) => (
            <li
              key={`${r.code}-${i}`}
              className={`rounded-xl border p-3 ${SEVERITY_STYLE[r.severity]}`}
              data-code={r.code}
            >
              <span className="mr-2 rounded bg-white/70 px-1.5 py-0.5 text-xs font-semibold">
                {SEVERITY_LABEL[r.severity]}
              </span>
              <span>{r.bn}</span>
              <p lang="en" className="mt-1 text-sm text-ink-soft">
                {r.en}
              </p>
              {r.basis ? <p className="mt-1 text-xs text-ink-soft">ভিত্তি: {r.basis}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Holders and balances */}
      <section aria-labelledby="holders-title">
        <h3 id="holders-title" className="text-lg font-semibold">
          মালিক ও বিক্রয়যোগ্য অংশ{" "}
          <span lang="en" className="text-sm font-normal text-ink-soft">
            Holders and sellable share
          </span>
        </h3>
        <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-paper text-ink-soft">
              <tr>
                <th scope="col" className="p-1.5 sm:p-2">
                  মালিক
                </th>
                <th scope="col" className="p-1.5 sm:p-2">
                  রেকর্ডীয়
                </th>
                <th scope="col" className="p-1.5 sm:p-2">
                  বিক্রি/বায়না/বন্ধক
                </th>
                <th scope="col" className="p-1.5 sm:p-2">
                  বিক্রয়যোগ্য
                </th>
              </tr>
            </thead>
            <tbody>
              {report.holders.map((h) => (
                <tr key={h.owner_id} className="border-t border-line">
                  <td className="p-1.5 sm:p-2">
                    {h.name_bn}
                    {h.is_deceased ? (
                      <span className="ml-1 text-xs text-verdict-amber">(মৃত)</span>
                    ) : null}
                  </td>
                  <td className="p-1.5 sm:p-2">{dec(h.recorded_dec)}</td>
                  <td className="p-1.5 sm:p-2">
                    {bn(h.sold_dec)} / {bn(h.reserved_dec)} / {bn(h.locked_dec)}
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
          বিক্রয়যোগ্য = রেকর্ডীয় অংশ − বিক্রি − চলমান বায়না − বন্ধক।
        </p>
      </section>

      {/* Record chain */}
      <section aria-labelledby="chain-title">
        <h3 id="chain-title" className="text-lg font-semibold">
          রেকর্ডের ধারা{" "}
          <span lang="en" className="text-sm font-normal text-ink-soft">
            Record chain CS → SA → RS → BS
          </span>
        </h3>
        <ol className="mt-2 grid gap-2 sm:grid-cols-4">
          {report.chain.map((c) => (
            <li
              key={c.survey}
              className="relative rounded-xl border border-line bg-card p-3 text-sm"
            >
              <p className="font-semibold text-brand">
                {SURVEY_BN[c.survey]} ({bn(c.year)})
              </p>
              <p>খতিয়ান {bn(c.khatian_no)}</p>
              <p>দাগ {bn(c.survey_dag_no)}</p>
              <p>{dec(c.area_dec)}</p>
              <p className="mt-1 text-ink-soft">{c.owners.map((o) => o.name_bn).join(", ")}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Area */}
      <section className="rounded-xl border border-line bg-card p-3 text-sm">
        <p>
          খতিয়ানে আয়তন: <strong>{dec(dag.recorded_area_dec)}</strong>
          {report.map_area_dec != null ? (
            <>
              {" "}
              · মৌজা ম্যাপে মাপ: <strong>{dec(report.map_area_dec)}</strong>
            </>
          ) : (
            <> · এই মৌজার ম্যাপ নেই</>
          )}
        </p>
        <p className="mt-1 text-ink-soft">
          শ্রেণি: {dag.land_class_bn} · লেজার সংস্করণ {bn(report.ledger_version)} · যাচাইয়ের তারিখ{" "}
          {bn(report.checked_on)}
        </p>
      </section>

      {/* Next steps: the same dag carried into the other tools. */}
      <nav
        aria-label="এরপর কী করবেন"
        className="rounded-xl border border-line bg-card p-3"
        data-testid="next-steps"
      >
        <p className="text-sm font-semibold">এরপর কী করবেন</p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {report.map_area_dec != null ? (
            <Link
              href={`/map?mouza=${dag.mouza_en.toLowerCase()}&dag=${dag.dag_no}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-brand px-3 text-brand"
            >
              ম্যাপে দেখুন
            </Link>
          ) : null}
          {report.holders.some((h) => h.is_deceased) ? (
            <Link
              href={`/warish?owner=${report.holders.find((h) => h.is_deceased)!.owner_id}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-brand px-3 text-brand"
            >
              ওয়ারিশ হিসাব
            </Link>
          ) : null}
          <Link
            href={`/chat?q=${encodeURIComponent(`${dag.mouza_bn} মৌজার ${bn(dag.dag_no)} নম্বর দাগ নিয়ে জানতে চাই: `)}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-brand px-3 text-brand"
          >
            সাথীকে জিজ্ঞাসা করুন
          </Link>
          <Link
            href="/deed"
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-3"
          >
            দলিল যাচাই
          </Link>
        </div>
      </nav>

      <SealPanel mouza={dag.mouza_en} dagNo={dag.dag_no} />

      <p className="rounded-xl bg-brand-soft p-3 text-sm">
        {report.disclaimer_bn}
        <span lang="en" className="mt-1 block text-ink-soft">
          {report.disclaimer_en}
        </span>
      </p>
    </article>
  );
}
