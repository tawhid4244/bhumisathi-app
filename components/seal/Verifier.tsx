"use client";

import { useCallback, useEffect, useState } from "react";
import { VerdictIcon } from "../VerdictIcon";

// Reads the code from the link (/verify#BS1.…, the part after # never reaches any server log)
// or from the box, asks /api/tools/seal_verify, and shows four lights.

type Light = { ok: boolean; bn: string };
interface Check {
  overall: "green" | "amber" | "red";
  overall_bn: string;
  overall_en: string;
  lights: { genuine: Light; current: Light; untouched: Light; shares_add_up: Light };
  payload: {
    issued_at: string;
    mouza_bn: string;
    jl_no: number;
    dag_no: number;
    area_dec: number;
    verdict: "red" | "amber" | "green";
    holders: { name_bn: string; recorded_dec: number; sellable_dec: number }[];
    ledger_version: number;
  } | null;
}

const LIGHTS: { key: keyof Check["lights"]; bn: string; en: string }[] = [
  { key: "genuine", bn: "আসল", en: "Genuine" },
  { key: "current", bn: "হালনাগাদ", en: "Current" },
  { key: "untouched", bn: "অক্ষত", en: "Untouched" },
  { key: "shares_add_up", bn: "অংশের যোগফল মেলে", en: "Shares add up" },
];

const BANNER = {
  green: "bg-verdict-green text-white",
  amber: "bg-verdict-amber text-white",
  red: "bg-verdict-red text-white",
} as const;

const VERDICT_BN = { green: "সবুজ", amber: "হলুদ", red: "লাল" } as const;
const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

export function Verifier() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/seal_verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: value.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.bn ?? "যাচাই করা যায়নি।");
      setResult(json as Check);
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, []);

  // Opened from a QR code: the code is in the link after "#".
  useEffect(() => {
    const fromLink = decodeURIComponent(window.location.hash.slice(1));
    if (!fromLink) return;
    void (async () => {
      setCode(fromLink);
      await check(fromLink);
    })();
  }, [check]);

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void check(code);
        }}
        className="space-y-2"
      >
        <label htmlFor="seal-code" className="block font-medium">
          রিপোর্টের কোড{" "}
          <span lang="en" className="text-sm text-ink-soft">
            Report code
          </span>
        </label>
        <textarea
          id="seal-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={3}
          placeholder="BS1.…"
          className="w-full min-w-0 break-all rounded-lg border border-line p-3 font-mono text-xs"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="min-h-11 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "যাচাই হচ্ছে…" : "যাচাই করুন"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-xl border border-verdict-red/40 bg-red-50 p-3">
          {error}
        </p>
      ) : null}

      {result ? (
        <section aria-live="polite" data-overall={result.overall} className="space-y-4">
          <div className={`flex items-center gap-3 rounded-xl p-4 ${BANNER[result.overall]}`}>
            <VerdictIcon verdict={result.overall} />
            <div>
              <p className="text-xl font-bold" data-testid="seal-overall">
                {result.overall_bn}
              </p>
              <p lang="en" className="text-sm opacity-90">
                {result.overall_en}
              </p>
            </div>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2" aria-label="চারটি বাতি / Four lights">
            {LIGHTS.map((l) => {
              const v = result.lights[l.key];
              return (
                <li
                  key={l.key}
                  data-light={l.key}
                  data-ok={v.ok}
                  className={`rounded-xl border p-3 ${v.ok ? "border-verdict-green/40 bg-green-50" : "border-verdict-amber/40 bg-amber-50"}`}
                >
                  <p className="flex items-center gap-2 font-semibold">
                    <VerdictIcon
                      verdict={v.ok ? "green" : result.overall === "red" ? "red" : "amber"}
                      className="h-6 w-6"
                    />
                    {l.bn}{" "}
                    <span lang="en" className="text-sm font-normal text-ink-soft">
                      {l.en}
                    </span>
                  </p>
                  <p className="mt-1 text-sm">{v.bn}</p>
                </li>
              );
            })}
          </ul>

          {result.payload ? (
            <section className="rounded-xl border border-line bg-card p-3 text-sm">
              <h2 className="font-semibold">রিপোর্টে যা লেখা আছে</h2>
              <p className="mt-1">
                {result.payload.mouza_bn} মৌজা (জে.এল. {bn(result.payload.jl_no)}), দাগ{" "}
                {bn(result.payload.dag_no)} — {bn(result.payload.area_dec)} শতক · রায়{" "}
                {VERDICT_BN[result.payload.verdict]}
              </p>
              <ul className="mt-1 list-disc pl-5">
                {result.payload.holders.map((h) => (
                  <li key={h.name_bn}>
                    {h.name_bn}: রেকর্ডে {bn(h.recorded_dec)} শতক, বিক্রয়যোগ্য {bn(h.sellable_dec)} শতক
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-ink-soft">
                স্বাক্ষর: {new Date(result.payload.issued_at).toLocaleString("bn-BD")} · লেজার সংস্করণ{" "}
                {bn(result.payload.ledger_version)}
              </p>
              {result.overall === "red" ? (
                <p className="mt-2 font-semibold text-verdict-red">
                  স্বাক্ষর মেলেনি, তাই ওপরের তথ্য বিশ্বাস করবেন না।
                </p>
              ) : null}
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
