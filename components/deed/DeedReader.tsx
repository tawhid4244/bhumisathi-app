"use client";

import Link from "next/link";
import { useState } from "react";
import type { DeedExtract } from "@/lib/ai/vision";
import type { Reason, Verdict } from "@/lib/engines/rules";
import { useLang, useNum } from "../i18n/LangProvider";
import { VerdictIcon } from "../VerdictIcon";

// Deed reader screen. Upload (or the synthetic sample) → /api/deed/upload → deed_read tool.
// The model only reads the paper; the verdict comes from checking the records in code.

interface ReadResult {
  model: string;
  deed: DeedExtract;
  summary_bn: string;
  summary_en: string;
  verdict: Verdict;
  findings: Reason[];
  dag: { mouza_bn: string; mouza_en: string; dag_no: number } | null;
}

const VERDICT = {
  red: { cls: "bg-verdict-red", bn: "লাল: দলিল ও রেকর্ডে গুরুতর অমিল", en: "Red: serious mismatch between deed and records" }, // prettier-ignore
  amber: {
    cls: "bg-verdict-amber",
    bn: "হলুদ: কিছু বিষয় যাচাই করুন",
    en: "Amber: check a few things",
  },
  green: { cls: "bg-verdict-green", bn: "সবুজ: দলিল রেকর্ডের সাথে মিলেছে", en: "Green: the deed matches the records" }, // prettier-ignore
} as const;

const SEV = { red: "border-verdict-red/40 bg-red-50", amber: "border-verdict-amber/40 bg-amber-50", info: "border-line bg-card" } as const; // prettier-ignore

const FIELDS: [keyof DeedExtract, string, string][] = [
  ["deed_no", "দলিল নং", "Deed no."],
  ["registered_on", "রেজিস্ট্রির তারিখ", "Registered on"],
  ["seller_name", "বিক্রেতা", "Seller"],
  ["buyer_name", "ক্রেতা", "Buyer"],
  ["mouza", "মৌজা", "Mouza"],
  ["jl_no", "জে.এল. নং", "JL no."],
  ["khatian_no", "খতিয়ান নং", "Khatian no."],
  ["dag_no", "দাগ নং", "Dag no."],
  ["area_dec", "জমির পরিমাণ (শতক)", "Area (decimals)"],
  ["price_tk", "মূল্য (টাকা)", "Price (Tk)"],
];

export function DeedReader() {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ReadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { t, lang } = useLang();
  const en = lang === "en";
  const num = useNum();
  const msg = (
    j: { error?: { bn?: string; en?: string } } | null,
    bnFallback: string,
    enFallback: string,
  ) => (en ? j?.error?.en : j?.error?.bn) ?? t(bnFallback, enFallback);

  async function read(uploadId: string) {
    const res = await fetch("/api/tools/deed_read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ upload_id: uploadId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(msg(json, "দলিল পড়া যায়নি।", "The deed could not be read."));
    setResult(json as ReadResult);
  }

  async function run(upload: () => Promise<Response>, previewUrl: string) {
    setBusy(true);
    setError(null);
    setResult(null);
    setPreview(previewUrl);
    try {
      const res = await upload();
      const json = await res.json();
      if (!res.ok) throw new Error(msg(json, "আপলোড হয়নি।", "Upload failed."));
      await read(json.upload_id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    void run(() => fetch("/api/deed/upload", { method: "POST", body }), URL.createObjectURL(file));
    e.target.value = "";
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-line bg-card p-4 shadow-sm">
        <h2 className="font-semibold">{t("দলিলের ছবি দিন", "Give a photo of the deed")}</h2>
        <p className="text-sm text-ink-soft">
          {t(
            "ছবি শুধু ব্যক্তিগত (প্রাইভেট) স্টোরেজে রাখা হয়। ডেমোর জন্য শুধু কাল্পনিক দলিল ব্যবহার করুন — আসল দলিল আপলোড করবেন না।",
            "Photos are kept in private storage only. Use synthetic deeds for the demo — do not upload a real deed.",
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-brand px-4 font-semibold text-white ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            {t("ছবি তুলুন / বেছে নিন", "Take or choose a photo")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              capture="environment"
              onChange={onFile}
              className="sr-only"
              disabled={busy}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => fetch("/api/deed/sample", { method: "POST" }), "/api/deed/sample")
            }
            className="min-h-11 rounded-lg border border-brand px-4 text-brand disabled:opacity-60"
          >
            {t("নমুনা দলিল (৪৫১২/২০২৪) ব্যবহার করুন", "Use the sample deed (4512/2024)")}
          </button>
        </div>
      </section>

      {busy ? (
        <p className="animate-pulse text-ink-soft">
          {t(
            "দলিল পড়া হচ্ছে… (১০–৩০ সেকেন্ড লাগতে পারে)",
            "Reading the deed… (may take 10–30 seconds)",
          )}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-verdict-red/40 bg-red-50 p-3">
          {error}
        </p>
      ) : null}

      {preview && (busy || result) ? (
        // eslint-disable-next-line @next/next/no-img-element -- a private upload preview, not an optimisable asset
        <img
          src={preview}
          alt={t("আপলোড করা দলিলের ছবি", "The uploaded deed photo")}
          className="max-h-80 w-full rounded-xl border border-line bg-white object-contain"
        />
      ) : null}

      {result ? (
        <article className="space-y-4" data-testid="deed-result">
          <section
            className={`flex items-center gap-3 rounded-2xl p-4 text-white ${VERDICT[result.verdict].cls}`}
            data-deed-verdict={result.verdict}
          >
            <VerdictIcon verdict={result.verdict} className="h-10 w-10 shrink-0" />
            <p className="text-xl font-bold">
              {en ? VERDICT[result.verdict].en : VERDICT[result.verdict].bn}
            </p>
          </section>

          <section className="rounded-xl border border-line bg-card p-3">
            <h3 className="font-semibold">{t("সহজ ভাষায় দলিলটি", "The deed in plain words")}</h3>
            <p className="mt-1" data-testid="deed-summary">
              {en ? result.summary_en : result.summary_bn}
            </p>
            {result.deed.marked_synthetic ? (
              <p className="mt-1 text-xs text-ink-soft">
                {t("দলিলে “নমুনা / কাল্পনিক” লেখা আছে।", "The deed is marked “sample / synthetic”.")}
              </p>
            ) : null}
          </section>

          <section aria-labelledby="findings-title">
            <h3 id="findings-title" className="font-semibold">
              {t("রেকর্ডের সাথে মিলিয়ে দেখা", "Checked against the records")}
            </h3>
            <ul className="mt-2 space-y-2">
              {result.findings.map((f, i) => (
                <li
                  key={`${f.code}-${i}`}
                  className={`rounded-xl border p-3 ${SEV[f.severity]}`}
                  data-code={f.code}
                >
                  {en ? f.en : f.bn}
                  {en ? null : (
                    <span lang="en" className="mt-1 block text-sm text-ink-soft">
                      {f.en}
                    </span>
                  )}
                  {f.basis ? (
                    <span className="mt-1 block text-xs text-ink-soft">
                      {t("ভিত্তি:", "Basis:")} {f.basis}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <details className="rounded-xl border border-line bg-card p-3 text-sm">
            <summary className="cursor-pointer font-semibold">
              {t("ছবি থেকে পড়া তথ্য", "Fields read from the photo")} ({t("মডেল", "model")}:{" "}
              {result.model})
            </summary>
            <table className="mt-2 w-full text-left">
              <tbody>
                {FIELDS.map(([k, labelBn, labelEn]) => (
                  <tr key={k} className="border-t border-line">
                    <th scope="row" className="p-1.5 font-medium">
                      {en ? labelEn : labelBn}
                    </th>
                    <td className="p-1.5">
                      {result.deed[k] == null ? "—" : num(String(result.deed[k]))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          {result.dag ? (
            <Link
              href={`/check?mouza=${result.dag.mouza_en.toLowerCase()}&by=dag&no=${result.dag.dag_no}`}
              className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 font-semibold text-white"
            >
              {t(
                `দাগ ${num(result.dag.dag_no)}-এর পূর্ণ জমি যাচাই রিপোর্ট →`,
                `Full land check report for dag ${result.dag.dag_no} →`,
              )}
            </Link>
          ) : null}

          <p className="rounded-xl bg-brand-soft p-3 text-xs">
            {t(
              "ছবি থেকে পড়া তথ্যে ভুল হতে পারে; চূড়ান্ত সিদ্ধান্তের আগে মূল দলিল ও সাব-রেজিস্ট্রি অফিসের রেকর্ড মিলিয়ে নিন। এটি আইনি মতামত নয়।",
              "Reading from a photo can make mistakes; compare with the original deed and the sub-registry records before deciding. This is not legal advice.",
            )}
          </p>
        </article>
      ) : null}
    </div>
  );
}
