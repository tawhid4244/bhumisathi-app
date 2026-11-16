"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocCheck } from "@/lib/engines/documents";
import { Bi, useLang, useNum } from "../i18n/LangProvider";
import { VerdictIcon } from "../VerdictIcon";

// /verify/doc#BD1.… — checks a signed document (certified khatian copy …) with four lights.
// The code after "#" never reaches any server log; it is sent once, in a POST body.

const LIGHTS: { key: keyof DocCheck["lights"]; bn: string; en: string }[] = [
  { key: "genuine", bn: "আসল", en: "Genuine" },
  { key: "on_record", bn: "অফিসের রেকর্ডে আছে", en: "On record" },
  { key: "untouched", bn: "অক্ষত", en: "Untouched" },
  { key: "current", bn: "হালনাগাদ", en: "Current" },
];

const BANNER = {
  green: "bg-verdict-green text-white",
  amber: "bg-verdict-amber text-white",
  red: "bg-verdict-red text-white",
} as const;

const SURVEY_BN = { CS: "সিএস", SA: "এসএ", RS: "আরএস", BS: "বিএস" } as const;

export function DocVerifier() {
  const { t, lang } = useLang();
  const en = lang === "en";
  const num = useNum();
  const enRef = useRef(en);
  useEffect(() => {
    enRef.current = en;
  }, [en]);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<DocCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/document_verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: value.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((enRef.current ? json?.error?.en : json?.error?.bn) ?? (enRef.current ? "Could not verify." : "যাচাই করা যায়নি।")); // prettier-ignore
      setResult(json as DocCheck);
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const fromLink = decodeURIComponent(window.location.hash.slice(1));
    if (!fromLink) return;
    void (async () => {
      setCode(fromLink);
      await check(fromLink);
    })();
  }, [check]);

  const p = result?.payload;
  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void check(code);
        }}
        className="space-y-2"
      >
        <label htmlFor="doc-code" className="block font-medium">
          <Bi bn="ডকুমেন্টের কোড" en="Document code" />
        </label>
        <textarea
          id="doc-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={3}
          placeholder="BD1.…"
          className="w-full min-w-0 break-all rounded-lg border border-line p-3 font-mono text-xs"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="min-h-11 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60"
        >
          {busy ? t("যাচাই হচ্ছে…", "Checking…") : t("যাচাই করুন", "Verify")}
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
            <p className="text-xl font-bold" data-testid="doc-overall">
              {en ? result.overall_en : result.overall_bn}
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
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
                    <Bi bn={l.bn} en={l.en} />
                  </p>
                  <p className="mt-1 text-sm">{en ? v.en : v.bn}</p>
                </li>
              );
            })}
          </ul>
          {p ? (
            <section className="rounded-xl border border-line bg-card p-3 text-sm">
              <h2 className="font-semibold">
                {t("ডকুমেন্টে যা লেখা আছে", "What the document says")}
              </h2>
              <p className="mt-1">
                {en
                  ? `Certified ${p.survey} khatian ${p.khatian_no} (${p.year}) · ${p.mouza_en} mouza (JL ${p.jl_no}), dag ${p.dag_no}, ${p.area_dec} dec · application ${p.app_no}`
                  : `${SURVEY_BN[p.survey]} খতিয়ান ${num(p.khatian_no)} (${num(p.year)}) · ${p.mouza_bn} মৌজা (জে.এল. ${num(p.jl_no)}), দাগ ${num(p.dag_no)}, ${num(p.area_dec)} শতক · আবেদন ${p.app_no}`}
              </p>
              <ul className="mt-1 list-disc pl-5">
                {p.owners.map((o) => (
                  <li key={o.name_bn}>
                    {en
                      ? `${o.name_en}: ${o.share_dec} dec`
                      : `${o.name_bn}: ${num(o.share_dec)} শতক`}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-ink-soft">
                {t("স্বাক্ষর:", "Signed:")}{" "}
                {new Date(p.issued_at).toLocaleString(en ? "en-GB" : "bn-BD")}
              </p>
              {result.overall === "red" ? (
                <p className="mt-2 font-semibold text-verdict-red">
                  {t(
                    "স্বাক্ষর মেলেনি, তাই ওপরের তথ্য বিশ্বাস করবেন না।",
                    "The signature does not match, so do not trust the details above.",
                  )}
                </p>
              ) : null}
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
