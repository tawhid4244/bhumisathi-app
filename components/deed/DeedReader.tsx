"use client";

import Link from "next/link";
import { useState } from "react";
import type { DeedExtract } from "@/lib/ai/vision";
import { bn, type Reason, type Verdict } from "@/lib/engines/rules";
import { VerdictIcon } from "../VerdictIcon";

// Deed reader screen. Upload (or the synthetic sample) → /api/deed/upload → deed_read tool.
// The model only reads the paper; the verdict comes from checking the records in code.

interface ReadResult {
  model: string;
  deed: DeedExtract;
  summary_bn: string;
  verdict: Verdict;
  findings: Reason[];
  dag: { mouza_bn: string; mouza_en: string; dag_no: number } | null;
}

const VERDICT = {
  red: { cls: "bg-verdict-red", bn: "লাল: দলিল ও রেকর্ডে গুরুতর অমিল" },
  amber: { cls: "bg-verdict-amber", bn: "হলুদ: কিছু বিষয় যাচাই করুন" },
  green: { cls: "bg-verdict-green", bn: "সবুজ: দলিল রেকর্ডের সাথে মিলেছে" },
} as const;

const SEV = { red: "border-verdict-red/40 bg-red-50", amber: "border-verdict-amber/40 bg-amber-50", info: "border-line bg-card" } as const; // prettier-ignore

const FIELDS: [keyof DeedExtract, string][] = [
  ["deed_no", "দলিল নং"],
  ["registered_on", "রেজিস্ট্রির তারিখ"],
  ["seller_name", "বিক্রেতা"],
  ["buyer_name", "ক্রেতা"],
  ["mouza", "মৌজা"],
  ["jl_no", "জে.এল. নং"],
  ["khatian_no", "খতিয়ান নং"],
  ["dag_no", "দাগ নং"],
  ["area_dec", "জমির পরিমাণ (শতক)"],
  ["price_tk", "মূল্য (টাকা)"],
];

export function DeedReader() {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ReadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function read(uploadId: string) {
    const res = await fetch("/api/tools/deed_read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ upload_id: uploadId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.bn ?? "দলিল পড়া যায়নি।");
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
      if (!res.ok) throw new Error(json?.error?.bn ?? "আপলোড হয়নি।");
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
        <h2 className="font-semibold">দলিলের ছবি দিন</h2>
        <p className="text-sm text-ink-soft">
          ছবি শুধু ব্যক্তিগত (প্রাইভেট) স্টোরেজে রাখা হয়। ডেমোর জন্য শুধু কাল্পনিক দলিল ব্যবহার করুন — আসল দলিল
          আপলোড করবেন না।
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-brand px-4 font-semibold text-white ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            ছবি তুলুন / বেছে নিন
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
            নমুনা দলিল (৪৫১২/২০২৪) ব্যবহার করুন
          </button>
        </div>
      </section>

      {busy ? (
        <p className="animate-pulse text-ink-soft">দলিল পড়া হচ্ছে… (১০–৩০ সেকেন্ড লাগতে পারে)</p>
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
          alt="আপলোড করা দলিলের ছবি"
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
            <p className="text-xl font-bold">{VERDICT[result.verdict].bn}</p>
          </section>

          <section className="rounded-xl border border-line bg-card p-3">
            <h3 className="font-semibold">সহজ ভাষায় দলিলটি</h3>
            <p className="mt-1" data-testid="deed-summary">
              {result.summary_bn}
            </p>
            {result.deed.marked_synthetic ? (
              <p className="mt-1 text-xs text-ink-soft">দলিলে “নমুনা / কাল্পনিক” লেখা আছে।</p>
            ) : null}
          </section>

          <section aria-labelledby="findings-title">
            <h3 id="findings-title" className="font-semibold">
              রেকর্ডের সাথে মিলিয়ে দেখা
            </h3>
            <ul className="mt-2 space-y-2">
              {result.findings.map((f, i) => (
                <li
                  key={`${f.code}-${i}`}
                  className={`rounded-xl border p-3 ${SEV[f.severity]}`}
                  data-code={f.code}
                >
                  {f.bn}
                  <span lang="en" className="mt-1 block text-sm text-ink-soft">
                    {f.en}
                  </span>
                  {f.basis ? (
                    <span className="mt-1 block text-xs text-ink-soft">ভিত্তি: {f.basis}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <details className="rounded-xl border border-line bg-card p-3 text-sm">
            <summary className="cursor-pointer font-semibold">
              ছবি থেকে পড়া তথ্য (মডেল: {result.model})
            </summary>
            <table className="mt-2 w-full text-left">
              <tbody>
                {FIELDS.map(([k, label]) => (
                  <tr key={k} className="border-t border-line">
                    <th scope="row" className="p-1.5 font-medium">
                      {label}
                    </th>
                    <td className="p-1.5">
                      {result.deed[k] == null ? "—" : bn(String(result.deed[k]))}
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
              দাগ {bn(result.dag.dag_no)}-এর পূর্ণ জমি যাচাই রিপোর্ট →
            </Link>
          ) : null}

          <p className="rounded-xl bg-brand-soft p-3 text-xs">
            ছবি থেকে পড়া তথ্যে ভুল হতে পারে; চূড়ান্ত সিদ্ধান্তের আগে মূল দলিল ও সাব-রেজিস্ট্রি অফিসের রেকর্ড
            মিলিয়ে নিন। এটি আইনি মতামত নয়।
          </p>
        </article>
      ) : null}
    </div>
  );
}
