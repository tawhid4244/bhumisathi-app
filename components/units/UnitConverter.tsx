"use client";

import { useState } from "react";
import type { Conversion, UnitId } from "@/lib/engines/units";
import { UNIT_BN, UNIT_IDS } from "@/lib/engines/units";
import { bn } from "@/lib/engines/rules";

// Land unit converter. Maths and the regional table live in the unit_convert tool
// (lib/engines/units.ts + content/units.json); this screen collects the amounts and shows results.

interface Row {
  value: string;
  unit: UnitId;
}

const KANI_UNITS = new Set<UnitId>(["kani", "gonda", "kora", "kranti"]);
const toNum = (s: string) => Number(s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));
const field = "min-h-11 min-w-0 rounded-lg border border-line bg-white px-3 text-base";

export function UnitConverter() {
  const [rows, setRows] = useState<Row[]>([{ value: "", unit: "decimal" }]);
  const [kani, setKani] = useState<string>("all");
  const [customKani, setCustomKani] = useState("");
  const [bigha, setBigha] = useState("");
  const [result, setResult] = useState<Conversion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const usesKani = rows.some((r) => KANI_UNITS.has(r.unit));

  async function convert(input = rows) {
    setError(null);
    const amounts = input
      .filter((r) => r.value.trim() !== "")
      .map((r) => ({ value: toNum(r.value), unit: r.unit }));
    if (amounts.length === 0 || amounts.some((a) => !(a.value >= 0))) {
      setError("সঠিক পরিমাণ লিখুন।");
      return;
    }
    const kaniDec =
      kani === "custom" ? toNum(customKani) : kani === "all" ? undefined : Number(kani);
    const body: Record<string, unknown> = { amounts };
    if (kaniDec && kaniDec > 0) body.kani_dec = kaniDec;
    if (bigha.trim() && toNum(bigha) > 0) body.bigha_dec = toNum(bigha);
    const res = await fetch("/api/tools/unit_convert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.bn ?? "রূপান্তর করা যায়নি।");
      setResult(null);
      return;
    }
    setResult(json as Conversion);
  }

  function example() {
    const ex: Row[] = [
      { value: "2", unit: "kani" },
      { value: "5", unit: "gonda" },
    ];
    setRows(ex);
    setKani("all");
    void convert(ex);
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void convert();
        }}
        className="space-y-3 rounded-xl border border-line bg-card p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">দলিলে যে পরিমাণ লেখা আছে</h2>
          <button
            type="button"
            onClick={example}
            className="min-h-10 rounded-lg border border-brand px-3 text-sm text-brand"
          >
            উদাহরণ: ২ কানি ৫ গন্ডা
          </button>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <label className="sr-only" htmlFor={`amt-${i}`}>
              পরিমাণ {bn(i + 1)}
            </label>
            <input
              id={`amt-${i}`}
              value={r.value}
              onChange={(e) =>
                setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
              }
              inputMode="decimal"
              placeholder="পরিমাণ"
              className={`${field} w-28 flex-1`}
            />
            <label className="sr-only" htmlFor={`unit-${i}`}>
              একক {bn(i + 1)}
            </label>
            <select
              id={`unit-${i}`}
              value={r.unit}
              onChange={(e) =>
                setRows(
                  rows.map((x, j) => (j === i ? { ...x, unit: e.target.value as UnitId } : x)),
                )
              }
              className={`${field} flex-1`}
            >
              {UNIT_IDS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_BN[u]}
                </option>
              ))}
            </select>
            {rows.length > 1 ? (
              <button
                type="button"
                aria-label={`সারি ${bn(i + 1)} বাদ দিন`}
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="min-h-11 rounded-lg border border-line px-3"
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
        {rows.length < 6 ? (
          <button
            type="button"
            onClick={() => setRows([...rows, { value: "", unit: "gonda" }])}
            className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm"
          >
            + আরেকটি একক যোগ করুন (যেমন কানি + গন্ডা)
          </button>
        ) : null}

        {usesKani ? (
          <fieldset className="rounded-lg bg-paper p-3">
            <legend className="text-sm font-medium">আপনার এলাকায় ১ কানি কত শতক?</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {[
                ["all", "জানি না — সব মাপে দেখাও"],
                ["120", "১২০ শতক"],
                ["40", "৪০ শতক"],
                ["30", "৩০ শতক"],
                ["custom", "অন্য"],
              ].map(([v, l]) => (
                <label
                  key={v}
                  className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${kani === v ? "border-brand bg-brand-soft" : "border-line bg-white"}`}
                >
                  <input
                    type="radio"
                    name="kani"
                    checked={kani === v}
                    onChange={() => setKani(v!)}
                  />
                  {l}
                </label>
              ))}
            </div>
            {kani === "custom" ? (
              <input
                value={customKani}
                onChange={(e) => setCustomKani(e.target.value)}
                inputMode="decimal"
                aria-label="আপনার কানির মাপ (শতক)"
                placeholder="শতক"
                className={`${field} mt-2 w-32`}
              />
            ) : null}
          </fieldset>
        ) : null}

        <label className="grid gap-1 text-sm font-medium">
          বিঘার মাপ (শতক) — খালি রাখলে প্রমিত ৩৩.০৬ শতক
          <input
            value={bigha}
            onChange={(e) => setBigha(e.target.value)}
            inputMode="decimal"
            placeholder="৩৩.০৬"
            className={`${field} w-40`}
          />
        </label>

        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-brand px-4 font-semibold text-white sm:w-auto"
        >
          রূপান্তর করুন
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-xl border border-verdict-amber/40 bg-amber-50 p-3">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="space-y-3" data-testid="unit-result">
          <div className={`grid gap-3 ${result.variants.length > 1 ? "sm:grid-cols-3" : ""}`}>
            {result.variants.map((v) => (
              <article
                key={String(v.kani_dec)}
                className="rounded-xl border border-line bg-card p-3"
                data-kani={v.kani_dec ?? "none"}
              >
                <h3 className="font-semibold">{v.label_bn}</h3>
                {v.where_bn ? <p className="text-xs text-ink-soft">{v.where_bn}</p> : null}
                <p
                  className="mt-2 text-2xl font-bold text-brand"
                  data-testid={`dec-${v.kani_dec ?? "none"}`}
                >
                  {bn(v.units.decimals)} শতক
                </p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  <li>{bn(v.units.acre)} একর</li>
                  <li>{bn(v.units.sqft.toLocaleString("en-IN"))} বর্গফুট</li>
                  <li>{bn(v.units.sqm)} বর্গমিটার</li>
                  <li>{bn(v.units.katha)} কাঠা</li>
                  <li>
                    {bn(v.units.bigha)} বিঘা ({bn(v.units.bigha_dec)} শতকে)
                  </li>
                  {v.units.kani != null ? <li>{bn(v.units.kani)} কানি</li> : null}
                </ul>
                {v.source ? <p className="mt-2 text-xs text-ink-soft">সূত্র: {v.source}</p> : null}
              </article>
            ))}
          </div>
          <ul className="list-disc space-y-1 rounded-xl bg-brand-soft p-3 pl-7 text-sm">
            {result.rules_bn.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
