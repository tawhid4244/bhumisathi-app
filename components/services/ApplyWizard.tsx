"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MouzaOption } from "@/lib/engines/mouzas";
import { feeFor, SURVEYS, type ApplicationType, type Survey } from "@/lib/services/catalog";
import { T, useLang, useNum } from "../i18n/LangProvider";

// Three-step service wizard: land → documents → fee and submit. The fee is computed from the
// same official lines the server uses (content/fees.json); the server recomputes it anyway.

const SURVEY_BN: Record<Survey, string> = { CS: "সিএস", SA: "এসএ", RS: "আরএস", BS: "বিএস" };

export function ApplyWizard({ type, mouzas }: { type: ApplicationType; mouzas: MouzaOption[] }) {
  const { t, lang } = useLang();
  const num = useNum();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mouza, setMouza] = useState(mouzas[0]?.name_en ?? "");
  const [dag, setDag] = useState("");
  const [survey, setSurvey] = useState<Survey>("BS");
  const [delivery, setDelivery] = useState<"online" | "post">("online");
  const [ticked, setTicked] = useState<boolean[]>(type.documents.map(() => false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dagNo = Number(dag.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));
  const dagOk = Number.isInteger(dagNo) && dagNo > 0 && dagNo < 100000;
  const lines = feeFor(type.id, { mouza, dag_no: dagNo || 1, survey, delivery });
  const total = lines.reduce((s, l) => s + l.tk, 0);
  const steps = [t("জমি", "Land"), t("কাগজপত্র", "Documents"), t("ফি ও জমা", "Fee and submit")];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/application_submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: type.id,
          details: { mouza, dag_no: dagNo, survey, delivery },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ? (lang === "en" ? json.error.en : json.error.bn) : t("দুঃখিত, জমা হয়নি।", "Sorry, it was not submitted.")); // prettier-ignore
        return;
      }
      router.push(`/my/applications/${json.app_no}?new=1`);
    } finally {
      setBusy(false);
    }
  }

  const input = "min-h-11 rounded-lg border border-line bg-white px-3 text-base";
  const choice = (on: boolean) =>
    `flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 ${on ? "border-brand bg-brand-soft font-semibold" : "border-line bg-white"}`;

  return (
    <div
      className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6"
      data-testid="apply-wizard"
    >
      {/* progress */}
      <ol className="mb-5 grid grid-cols-3 gap-2" aria-label={t("ধাপ", "Steps")}>
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className="text-center text-sm"
          >
            <span
              className={`mb-1 block h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-gray-200"}`}
            />
            <span className={i === step ? "font-semibold text-brand-deep" : "text-ink-soft"}>
              {num(i + 1)}. {s}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <fieldset className="grid gap-4">
          <legend className="mb-2 text-lg font-semibold">
            {t("কোন জমির খতিয়ান?", "Which land's khatian?")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              {t("মৌজা", "Mouza")}
              <select value={mouza} onChange={(e) => setMouza(e.target.value)} className={input}>
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
                placeholder={t("যেমন ১৪১", "e.g. 141")}
                className={input}
                aria-invalid={dag !== "" && !dagOk}
              />
            </label>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">{t("কোন জরিপ", "Which survey")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
              {SURVEYS.map((s) => (
                <label key={s} className={choice(survey === s)}>
                  <input
                    type="radio"
                    name="survey"
                    checked={survey === s}
                    onChange={() => setSurvey(s)}
                  />
                  {lang === "en" ? s : SURVEY_BN[s]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">{t("কীভাবে নেবেন", "How to receive it")}</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              <label className={choice(delivery === "online")}>
                <input
                  type="radio"
                  name="delivery"
                  checked={delivery === "online"}
                  onChange={() => setDelivery("online")}
                />
                {t("অনলাইনে (QR সহ স্বাক্ষরিত কপি)", "Online (signed copy with QR)")}
              </label>
              <label className={choice(delivery === "post")}>
                <input
                  type="radio"
                  name="delivery"
                  checked={delivery === "post"}
                  onChange={() => setDelivery("post")}
                />
                {t("ডাকযোগে (অতিরিক্ত ফি)", "By post (extra fee)")}
              </label>
            </div>
          </div>
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-lg font-semibold">
            {t("যা যা লাগবে", "What you need")}
          </legend>
          {type.documents.map((d, i) => (
            <label key={d.en} className={choice(ticked[i]!)}>
              <input
                type="checkbox"
                checked={ticked[i]}
                onChange={(e) =>
                  setTicked((all) => all.map((v, j) => (j === i ? e.target.checked : v)))
                }
              />
              <T bn={d.bn} en={d.en} />
            </label>
          ))}
          <p className="text-sm text-ink-soft">
            {t(
              "সব কাগজ হাতে আছে কি না টিক দিয়ে নিশ্চিত করুন।",
              "Tick each item to confirm you have it.",
            )}
          </p>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-3" aria-labelledby="fee-h">
          <h2 id="fee-h" className="text-lg font-semibold">
            {t("সরকারি ফি", "Official fee")}
          </h2>
          <dl className="divide-y divide-line rounded-xl border border-line bg-white">
            {lines.map((l) => (
              <div key={l.en} className="flex justify-between px-3 py-2">
                <dt>
                  <T bn={l.bn} en={l.en} />
                </dt>
                <dd>
                  {t("৳", "Tk ")}
                  {num(l.tk)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between px-3 py-2 font-bold" data-testid="fee-total">
              <dt>{t("মোট", "Total")}</dt>
              <dd>
                {t("৳", "Tk ")}
                {num(total)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-ink-soft">
            {t("সূত্র: ", "Source: ")}
            <span lang="en">{type.fee_source}</span> · {type.fee_verified}
          </p>
          <p className="rounded-lg bg-brand-soft p-3 text-sm">
            {t(
              `${mouzas.find((m) => m.name_en === mouza)?.name_bn ?? mouza} মৌজা, দাগ ${num(dagNo)}, ${SURVEY_BN[survey]} খতিয়ান — ${delivery === "post" ? "ডাকযোগে" : "অনলাইনে"}। জমা দেওয়ার পর ফি পরিশোধ করবেন।`,
              `${mouza} mouza, dag ${dagNo}, ${survey} khatian — ${delivery === "post" ? "by post" : "online"}. You pay the fee after submitting.`,
            )}
          </p>
        </section>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-verdict-red/40 bg-red-50 p-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0 || busy}
          className="min-h-11 rounded-lg border border-line bg-white px-5 font-semibold disabled:opacity-40"
        >
          {t("← আগের ধাপ", "← Back")}
        </button>
        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={(step === 0 && !dagOk) || (step === 1 && !ticked.every(Boolean))}
            className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-deep disabled:opacity-40"
          >
            {t("পরের ধাপ →", "Next →")}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {busy ? t("জমা হচ্ছে…", "Submitting…") : t("আবেদন জমা দিন", "Submit application")}
          </button>
        )}
      </div>
    </div>
  );
}
