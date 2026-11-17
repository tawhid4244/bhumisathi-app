"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MouzaOption } from "@/lib/engines/mouzas";
import type { TaxReport } from "@/lib/engines/land-tax";
import { T, useLang, useNum } from "../i18n/LangProvider";

// Land development tax: look up a dag, see each holder's unpaid fiscal years and the amount (with
// the rule that produced it), then pay in the sandbox or — when nothing is owed (exempt) — get the
// dakhila straight away. Anyone may pay for a holding, as at the union land office.

export function PayTaxButton({
  mouza,
  dagNo,
  ownerId,
  due,
}: {
  mouza: string;
  dagNo: number;
  ownerId: number;
  due: number;
}) {
  // prettier-ignore
  const { t, lang } = useLang();
  const num = useNum();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tools/application_submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "land_tax", details: { mouza, dag_no: dagNo, owner_id: ownerId } }), // prettier-ignore
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.status === 401) {
      router.push(`/login?next=${encodeURIComponent("/land-tax")}`);
      return;
    }
    if (!res.ok || !json?.app_no) {
      setError(json?.error ? (lang === "en" ? json.error.en : json.error.bn) : t("দুঃখিত, সমস্যা হয়েছে।", "Sorry, something went wrong.")); // prettier-ignore
      return;
    }
    router.push(`/my/applications/${json.app_no}`);
  }
  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="min-h-11 rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {due > 0
          ? t(`৳${num(due)} পরিশোধ ও দাখিলা`, `Pay Tk ${due} and get the dakhila`)
          : t("দাখিলা নিন (৳০)", "Get the dakhila (Tk 0)")}{" "}
        {/* prettier-ignore */}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-verdict-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TaxTable({ report }: { report: TaxReport }) {
  const { t } = useLang();
  const num = useNum();
  return (
    <section className="rounded-2xl border border-line bg-card p-4" data-testid="tax-report">
      <h2 className="font-semibold">
        <T
          bn={`${report.mouza_bn} মৌজা, দাগ ${num(report.dag_no)} · ${report.land_class_bn} · চলতি অর্থবছর ${num(report.current_fy)}`}
          en={`${report.mouza_en} mouza, dag ${report.dag_no} · ${report.land_class_en} · current fiscal year ${report.current_fy}`}
        />
      </h2>
      <ul className="mt-3 space-y-3">
        {report.holders.map((h) => (
          <li
            key={h.owner_id}
            data-owner={h.owner_id}
            className="rounded-xl border border-line bg-white p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  <T bn={h.name_bn} en={h.name_en} />
                </p>
                <p className="text-sm text-ink-soft">
                  {t(
                    `অংশ ${num(h.share_dec)} শতক · ${num(h.paid_through_fy)} পর্যন্ত পরিশোধিত`,
                    `Share ${h.share_dec} dec · paid through ${h.paid_through_fy}`,
                  )}{" "}
                  {/* prettier-ignore */}
                </p>
              </div>
              {h.years_due.length === 0 ? (
                <span
                  className="rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-sm font-semibold text-green-900"
                  data-testid="tax-clear"
                >
                  {t("কোনো বকেয়া নেই", "Nothing due")}
                </span>
              ) : (
                <span
                  className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-900"
                  data-testid="tax-due"
                >
                  {t(
                    `${num(h.years_due.length)} অর্থবছর বাকি · ৳${num(h.due_tk)}`,
                    `${h.years_due.length} year(s) due · Tk ${h.due_tk}`,
                  )}{" "}
                  {/* prettier-ignore */}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm">
              <T bn={h.basis_bn} en={h.basis_en} />
            </p>
            {h.years_due.length ? (
              <>
                <p className="mt-1 text-xs text-ink-soft">
                  {t("বাকি অর্থবছর: ", "Years due: ")}
                  {num(h.years_due.join(", "))}
                </p>
                <div className="mt-2">
                  <PayTaxButton
                    mouza={report.mouza_en}
                    dagNo={report.dag_no}
                    ownerId={h.owner_id}
                    due={h.due_tk}
                  />
                </div>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">
        <T bn={report.note_bn} en={report.note_en} />
      </p>
      <p className="mt-1 text-xs text-ink-soft" lang="en">
        Source: {report.source} · {report.verified}
      </p>
    </section>
  );
}

export function LandTaxLookup({ mouzas }: { mouzas: MouzaOption[] }) {
  const { t, lang } = useLang();
  const num = useNum();
  const [mouza, setMouza] = useState(mouzas[0]?.name_en ?? "");
  const [dag, setDag] = useState("");
  const [report, setReport] = useState<TaxReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dagNo = Number(dag.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));

  async function look(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tools/land_tax_due", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mouza, dag_no: dagNo }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setReport(null);
      setError(json?.error ? (lang === "en" ? json.error.en : json.error.bn) : t("দুঃখিত, সমস্যা হয়েছে।", "Sorry, something went wrong.")); // prettier-ignore
      return;
    }
    setReport(json.reports[0] ?? null);
  }

  return (
    <div className="grid gap-4">
      <form
        onSubmit={look}
        className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-[1.2fr_1fr_auto] sm:items-end"
      >
        <label className="grid gap-1 text-sm font-medium">
          {t("মৌজা", "Mouza")}
          <select
            value={mouza}
            onChange={(e) => setMouza(e.target.value)}
            className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
          >
            {mouzas.map((m) => (
              <option key={m.code} value={m.name_en}>
                {lang === "en"
                  ? `${m.name_en} (JL ${m.jl_no})`
                  : `${m.name_bn} (জেএল ${num(m.jl_no)})`}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t("দাগ নম্বর", "Dag number")}
          <input
            value={dag}
            onChange={(e) => setDag(e.target.value)}
            inputMode="numeric"
            placeholder={t("যেমন ১৪৭", "e.g. 147")}
            className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
          />{" "}
          {/* prettier-ignore */}
        </label>
        <button
          type="submit"
          disabled={busy || !(dagNo > 0)}
          className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white disabled:opacity-60"
        >
          {t("কর হিসাব করুন", "Work out the tax")}
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-verdict-red">
          {error}
        </p>
      ) : null}
      {report ? <TaxTable report={report} /> : null}
    </div>
  );
}
