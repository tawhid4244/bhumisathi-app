"use client";

import Link from "next/link";
import { useState } from "react";
import type { DeceasedOwner, WarishLandResult } from "@/lib/engines/warish-land";
import { bnNum } from "@/lib/engines/warish";

// The warish screen. All maths happens in the warish_compute tool (lib/engines/warish.ts);
// this component only collects the family, shows the result, and runs a MOCK consent step.

interface Pred {
  type: "son" | "daughter";
  sons: number;
  daughters: number;
}

interface FormState {
  deceasedId: number | "manual";
  totalDec: string;
  spouse: "none" | "husband" | "wife";
  wives: number;
  father: boolean;
  mother: boolean;
  sons: number;
  daughters: number;
  brothers: number;
  sisters: number;
  preds: Pred[];
}

const EMPTY: FormState = {
  deceasedId: "manual",
  totalDec: "100",
  spouse: "none",
  wives: 1,
  father: false,
  mother: false,
  sons: 0,
  daughters: 0,
  brothers: 0,
  sisters: 0,
  preds: [],
};

/** Names for the G2 example family (synthetic). */
const G2_NAMES: Record<string, string> = {
  wife: "রোকেয়া বেগম",
  "son-1": "সোহেল",
  "son-2": "রুবেল",
  daughter: "নাসরিন",
};

const WOMEN = new Set(["wife", "mother", "daughter", "granddaughter", "sister"]);

// w-full + min-w-0: a <select> otherwise grows to its longest option and widens the page.
const field = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 text-base";

/** A 6-digit demo code. Mock only: a real system sends it by SMS to the heir's own phone. */
function newOtp(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(100000 + (n[0]! % 900000));
}

function Counter(props: {
  label: string;
  value: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  const { label, value, max = 20, onChange } = props;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-1">
      <span className="text-sm font-medium" id={`lbl-${label}`}>
        {label}
      </span>
      <div className="flex items-center gap-1" role="group" aria-labelledby={`lbl-${label}`}>
        <button
          type="button"
          aria-label={`${label} কমান`}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-10 w-10 rounded-md border border-line text-lg"
        >
          −
        </button>
        {/* prettier-ignore */}
        <output className="w-8 text-center font-semibold" aria-label={label}>
          {bnNum(value)}
        </output>
        <button
          type="button"
          aria-label={`${label} বাড়ান`}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="h-10 w-10 rounded-md border border-line text-lg"
        >
          +
        </button>
        {/* prettier-ignore */}
      </div>
    </div>
  );
}

export function WarishCalculator({
  deceased,
  initialOwnerId,
}: {
  deceased: DeceasedOwner[];
  /** Opened from a land report (/warish?owner=…): start with that deceased owner's land. */
  initialOwnerId?: number;
}) {
  const [form, setForm] = useState<FormState>(() =>
    initialOwnerId && deceased.some((d) => d.owner_id === initialOwnerId)
      ? { ...EMPTY, deceasedId: initialOwnerId }
      : EMPTY,
  );
  const [names, setNames] = useState<Record<string, string>>({});
  const [result, setResult] = useState<WarishLandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Mock OTP consent: code "sent" per heir, and which heirs confirmed.
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function loadExample() {
    const abdul = deceased[0];
    setForm({ ...EMPTY, deceasedId: abdul ? abdul.owner_id : "manual", spouse: "wife", wives: 1, sons: 2, daughters: 1 }); // prettier-ignore
    setNames(G2_NAMES);
    setResult(null);
  }

  async function calculate(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setCodes({});
    setTyped({});
    setConfirmed({});
    const family = {
      husband: form.spouse === "husband",
      wives: form.spouse === "wife" ? form.wives : 0,
      father: form.father,
      mother: form.mother,
      sons: form.sons,
      daughters: form.daughters,
      fullBrothers: form.brothers,
      fullSisters: form.sisters,
      predeceasedSons: form.preds.filter((p) => p.type === "son").map(({ sons, daughters }) => ({ sons, daughters })), // prettier-ignore
      predeceasedDaughters: form.preds.filter((p) => p.type === "daughter").map(({ sons, daughters }) => ({ sons, daughters })), // prettier-ignore
    };
    const total = Number(form.totalDec.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));
    const body =
      form.deceasedId === "manual"
        ? { family, ...(total > 0 ? { total_dec: total } : {}) }
        : { family, deceased_owner_id: form.deceasedId };
    try {
      const res = await fetch("/api/tools/warish_compute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.bn ?? "হিসাব করা যায়নি।");
      setResult(json as WarishLandResult);
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function sendOtp(key: string) {
    const code = newOtp();
    setCodes((c) => ({ ...c, [key]: code }));
  }

  const who = (s: WarishLandResult["shares"][number]) => (names[s.key] ? `${names[s.key]} (${s.label_bn})` : s.label_bn); // prettier-ignore
  const allConfirmed = result !== null && result.shares.every((s) => confirmed[s.key]);
  const women = result?.shares.filter((s) => WOMEN.has(s.relation)) ?? [];

  return (
    <div className="space-y-5">
      <form
        onSubmit={calculate}
        className="space-y-4 rounded-xl border border-line bg-card p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">১. কার জমি?</h2>
          <button
            type="button"
            onClick={loadExample}
            className="min-h-10 rounded-lg border border-brand px-3 text-sm text-brand"
          >
            উদাহরণ: আব্দুল করিমের পরিবার
          </button>
        </div>
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          মৃত ব্যক্তি ও তাঁর জমি
          <select
            value={String(form.deceasedId)}
            onChange={(e) =>
              set("deceasedId", e.target.value === "manual" ? "manual" : Number(e.target.value))
            }
            className={field}
          >
            {deceased.map((d) => (
              <option key={d.owner_id} value={d.owner_id}>
                {d.name_bn} —{" "}
                {d.holdings
                  .map((h) => `${h.mouza_bn} দাগ ${bnNum(h.dag_no)} (${bnNum(h.share_dec)} শতক)`)
                  .join(", ")}
              </option>
            ))}
            <option value="manual">অন্য কেউ — মোট জমি নিজে লিখব</option>
          </select>
        </label>
        {form.deceasedId === "manual" ? (
          <label className="grid min-w-0 gap-1 text-sm font-medium">
            মোট জমি (শতক)
            <input
              value={form.totalDec}
              onChange={(e) => set("totalDec", e.target.value)}
              inputMode="decimal"
              className={field}
            />
          </label>
        ) : null}

        <h2 className="pt-2 font-semibold">২. কে কে জীবিত আছেন?</h2>
        <fieldset>
          <legend className="text-sm font-medium">স্বামী / স্ত্রী</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {(
              [
                ["none", "নেই"],
                ["husband", "স্বামী"],
                ["wife", "স্ত্রী"],
              ] as const
            ).map(([v, l]) => (
              <label
                key={v}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 ${form.spouse === v ? "border-brand bg-brand-soft" : "border-line bg-white"}`}
              >
                <input
                  type="radio"
                  name="spouse"
                  checked={form.spouse === v}
                  onChange={() => set("spouse", v)}
                />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2 sm:grid-cols-2">
          {form.spouse === "wife" ? (
            <Counter
              label="স্ত্রীর সংখ্যা"
              value={form.wives}
              max={4}
              onChange={(n) => set("wives", Math.max(1, n))}
            />
          ) : null}
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-3">
            <input
              type="checkbox"
              checked={form.father}
              onChange={(e) => set("father", e.target.checked)}
            />{" "}
            বাবা জীবিত
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-3">
            <input
              type="checkbox"
              checked={form.mother}
              onChange={(e) => set("mother", e.target.checked)}
            />{" "}
            মা জীবিত
          </label>
          <Counter label="ছেলে" value={form.sons} onChange={(n) => set("sons", n)} />
          <Counter label="মেয়ে" value={form.daughters} onChange={(n) => set("daughters", n)} />
          <Counter label="আপন ভাই" value={form.brothers} onChange={(n) => set("brothers", n)} />
          <Counter label="আপন বোন" value={form.sisters} onChange={(n) => set("sisters", n)} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            আগে মারা যাওয়া ছেলে/মেয়ে, যাঁদের সন্তান আছে (মুসলিম পারিবারিক আইন অধ্যাদেশ ১৯৬১, ধারা ৪)
          </p>
          {form.preds.map((p, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border border-line bg-paper p-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center"
            >
              <select
                aria-label="মৃত সন্তান"
                value={p.type}
                onChange={(e) =>
                  set(
                    "preds",
                    form.preds.map((x, j) =>
                      j === i ? { ...x, type: e.target.value as Pred["type"] } : x,
                    ),
                  )
                }
                className={field}
              >
                <option value="son">মৃত ছেলে</option>
                <option value="daughter">মৃত মেয়ে</option>
              </select>
              <Counter
                label={`তাঁর ছেলে ${bnNum(i + 1)}`}
                value={p.sons}
                onChange={(n) =>
                  set(
                    "preds",
                    form.preds.map((x, j) => (j === i ? { ...x, sons: n } : x)),
                  )
                }
              />
              <Counter
                label={`তাঁর মেয়ে ${bnNum(i + 1)}`}
                value={p.daughters}
                onChange={(n) =>
                  set(
                    "preds",
                    form.preds.map((x, j) => (j === i ? { ...x, daughters: n } : x)),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  set(
                    "preds",
                    form.preds.filter((_, j) => j !== i),
                  )
                }
                className="min-h-10 rounded-md border border-line px-2 text-sm"
              >
                বাদ দিন
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set("preds", [...form.preds, { type: "son", sons: 1, daughters: 0 }])}
            className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm"
          >
            + আগে মারা যাওয়া সন্তান যোগ করুন
          </button>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60 sm:w-auto"
        >
          হিসাব করুন
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-xl border border-verdict-red/40 bg-red-50 p-3">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="space-y-4" aria-labelledby="result-title" data-testid="warish-result">
          <h2 id="result-title" className="text-lg font-semibold">
            ৩. প্রত্যেকের অংশ{result.deceased ? ` — ${result.deceased.name_bn}-এর জমি` : ""}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-paper text-ink-soft">
                <tr>
                  <th scope="col" className="p-2">
                    ওয়ারিশ
                  </th>
                  <th scope="col" className="p-2">
                    অংশ
                  </th>
                  {result.holdings.map((h) => (
                    <th key={`${h.mouza_bn}${h.dag_no}`} scope="col" className="p-2">
                      {h.dag_no ? `দাগ ${bnNum(h.dag_no)}` : "মোট জমি"}{" "}
                      <span className="block font-normal">({bnNum(h.share_dec)} শতক)</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.shares.map((s) => (
                  <tr key={s.key} className="border-t border-line" data-heir={s.key}>
                    <td className="p-2">
                      <span className="font-medium">{who(s)}</span>
                      <span className="block text-xs text-ink-soft">{s.basis_bn}</span>
                    </td>
                    <td className="p-2">
                      <span className="font-semibold" data-testid={`frac-${s.key}`}>
                        {bnNum(s.fraction)}
                      </span>
                      <span className="block text-xs text-ink-soft">{bnNum(s.percent)}%</span>
                    </td>
                    {s.per_dag.map((p) => (
                      <td
                        key={p.dag_no}
                        className="p-2 font-semibold"
                        data-testid={`dec-${s.key}-${p.dag_no}`}
                      >
                        {bnNum(p.decimals)} শতক
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {women.length > 0 ? (
            <section
              className="rounded-xl border border-brand/40 bg-brand-soft p-3 text-sm"
              aria-label="নারীর অংশ"
            >
              <p className="font-semibold">
                নারীর অংশ আইনে নির্ধারিত — কেউ তা থেকে বঞ্চিত করতে পারে না
              </p>
              <ul className="mt-1 list-disc pl-5">
                {women.map((s) => (
                  <li key={s.key}>
                    {who(s)}: {bnNum(s.fraction)} ({bnNum(s.percent)}%)
                    {s.total_dec ? `, মোট ${bnNum(s.total_dec)} শতক` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <details className="rounded-xl border border-line bg-card p-3 text-sm" open>
            <summary className="cursor-pointer font-semibold">হিসাব কীভাবে হলো</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {result.steps_bn.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </details>

          <section
            className="rounded-xl border border-line bg-card p-3"
            aria-labelledby="consent-title"
          >
            <h3 id="consent-title" className="font-semibold">
              ৪. প্রত্যেক ওয়ারিশের সম্মতি (ডেমো ওটিপি)
            </h3>
            <p className="text-xs text-ink-soft">
              আসল ব্যবস্থায় কোড প্রত্যেকের নিজের মোবাইলে এসএমএস হিসেবে যাবে। এখানে কোড পর্দায় দেখানো
              হচ্ছে।
            </p>
            <ul className="mt-2 space-y-2">
              {result.shares.map((s) => (
                <li key={s.key} className="rounded-lg bg-paper p-2" data-consent={s.key}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{who(s)}</span>
                    {confirmed[s.key] ? (
                      <span className="font-semibold text-verdict-green">✓ সম্মতি দিয়েছেন</span>
                    ) : !codes[s.key] ? (
                      <button
                        type="button"
                        onClick={() => sendOtp(s.key)}
                        className="min-h-10 rounded-md border border-line bg-white px-3 text-sm"
                      >
                        ওটিপি পাঠান
                      </button>
                    ) : null}
                  </div>
                  {codes[s.key] && !confirmed[s.key] ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-ink-soft">
                        ডেমো এসএমএস: কোড <span data-testid={`otp-${s.key}`}>{codes[s.key]}</span>
                      </span>
                      <input
                        aria-label={`${who(s)}-এর ওটিপি`}
                        value={typed[s.key] ?? ""}
                        onChange={(e) => setTyped((t) => ({ ...t, [s.key]: e.target.value }))}
                        inputMode="numeric"
                        maxLength={6}
                        className="min-h-10 w-28 rounded-md border border-line bg-white px-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmed((c) => ({ ...c, [s.key]: typed[s.key] === codes[s.key] }))
                        }
                        className="min-h-10 rounded-md bg-ink px-3 text-sm text-white"
                      >
                        নিশ্চিত করুন
                      </button>
                      {confirmed[s.key] === false ? (
                        <span className="text-xs text-verdict-red">কোড মেলেনি</span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {allConfirmed ? (
            <section
              className="rounded-xl border-2 border-verdict-green bg-white p-3"
              data-testid="bontonnama-checklist"
            >
              <h3 className="font-semibold">৫. এরপর যা করতে হবে: বণ্টননামা → নামজারি</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                <li>ইউনিয়ন পরিষদ / পৌরসভা থেকে ওয়ারিশ সনদ নিন।</li>
                <li>
                  সব ওয়ারিশ মিলে বণ্টননামা দলিল তৈরি ও সাব-রেজিস্ট্রি অফিসে রেজিস্ট্রি করুন (রাষ্ট্রীয়
                  অধিগ্রহণ ও প্রজাস্বত্ব আইন, ধারা ১৪৩খ; রেজিস্ট্রেশন আইন, ধারা ১৭)।
                </li>
                <li>
                  রেজিস্ট্রিকৃত বণ্টননামা দিয়ে প্রত্যেকে নিজ অংশের নামজারি করুন (ধারা ১৪৩; সরকারি ফি মোট
                  ১,১৭০ টাকা)।
                </li>
                <li>নামজারির পর নিজ নামে ভূমি উন্নয়ন কর দিন।</li>
              </ol>
              <p className="mt-2 text-sm">
                প্রশ্ন থাকলে{" "}
                <Link href="/chat" className="text-brand underline">
                  সাথী এআই-কে জিজ্ঞাসা করুন
                </Link>{" "}
                বা ১৬১২২-এ কল করুন।
              </p>
            </section>
          ) : null}

          <p className="rounded-xl bg-brand-soft p-3 text-xs">
            এটি হিসাবের সহায়ক (হানাফি ফারায়েজ, কাল্পনিক তথ্য)। বণ্টন বৈধ হয় রেজিস্ট্রিকৃত বণ্টননামা বা
            আদালতের মাধ্যমে। হিন্দু, খ্রিস্টান ও অন্যান্য উত্তরাধিকার আইন এখনও যুক্ত হয়নি।
          </p>
        </section>
      ) : null}
    </div>
  );
}
