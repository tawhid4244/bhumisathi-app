"use client";

import Link from "next/link";
import { useState } from "react";
import { useLang } from "../i18n/LangProvider";

// "Get a sealed report": a QR code with this report signed by BhumiSathi (Ed25519).
// A bank, buyer or court can scan it and check it on /verify — no account needed to verify.

interface Seal {
  code: string;
  verify_url: string;
  qr_svg: string;
  payload: { issued_at: string; ledger_version: number };
}

export function SealPanel({ mouza, dagNo }: { mouza: string; dagNo: number }) {
  const [seal, setSeal] = useState<Seal | null>(null);
  const [error, setError] = useState<{ bn: string; en: string; login?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const { t, lang } = useLang();
  const en = lang === "en";

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/seal_issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mouza, dag_no: dagNo }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        setError({ bn: "সিলযুক্ত রিপোর্ট নিতে লগইন করুন।", en: "Sign in to get a sealed report.", login: true }); // prettier-ignore
      } else if (!res.ok) {
        setError({ bn: json?.error?.bn ?? "রিপোর্ট তৈরি করা যায়নি।", en: json?.error?.en ?? "The report could not be made." }); // prettier-ignore
      } else {
        setSeal(json as Seal);
      }
    } finally {
      setBusy(false);
    }
  }

  const here = typeof window === "undefined" ? "/check" : `${location.pathname}${location.search}`;

  return (
    <section
      aria-labelledby="seal-title"
      className="rounded-xl border border-line bg-card p-3"
      data-testid="seal-panel"
    >
      <h3 id="seal-title" className="font-semibold">
        {t("সিলযুক্ত রিপোর্ট (BhumiSeal)", "Sealed report (BhumiSeal)")}
      </h3>
      <p className="text-sm text-ink-soft">
        {t(
          "ডিজিটাল স্বাক্ষর করা QR কোড — ব্যাংক বা ক্রেতা স্ক্যান করে যাচাই করতে পারবেন রিপোর্টটি আসল ও হালনাগাদ কি না।",
          "A digitally signed QR code — a bank or buyer can scan it to check that the report is genuine and current.",
        )}
      </p>
      {!seal ? (
        <button
          type="button"
          onClick={issue}
          disabled={busy}
          className="mt-2 min-h-11 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60"
        >
          {busy ? t("তৈরি হচ্ছে…", "Making…") : t("সিলযুক্ত রিপোর্ট নিন", "Get a sealed report")}
        </button>
      ) : (
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row">
          {/* The QR is an image from an SVG made on our server; as an <img> it cannot run code. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(seal.qr_svg)}`}
            alt={t(
              "যাচাইয়ের QR কোড — স্ক্যান করলে /verify পাতা খুলবে",
              "Verification QR code — scanning it opens the /verify page",
            )}
            width={200}
            height={200}
            className="h-auto w-48 max-w-full rounded border border-line bg-white"
            data-testid="seal-qr"
          />
          <div className="min-w-0 space-y-2 text-sm">
            <p>
              {t("স্বাক্ষরের সময়:", "Signed at:")}{" "}
              {new Date(seal.payload.issued_at).toLocaleString(en ? "en-GB" : "bn-BD")}
            </p>
            <Link
              href={`/verify#${seal.code}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-brand px-3 text-brand"
              data-testid="seal-verify-link"
            >
              {t("এখনই যাচাই করুন", "Verify now")}
            </Link>
            <details>
              <summary className="cursor-pointer">
                {t("কোডটি দেখুন (কাগজে না থাকলে)", "Show the code (if not on paper)")}
              </summary>
              <p className="mt-1 break-all font-mono text-xs" data-testid="seal-code">
                {seal.code}
              </p>
            </details>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-verdict-red">
          {en ? error.en : error.bn}{" "}
          {error.login ? (
            <Link href={`/login?next=${encodeURIComponent(here)}`} className="underline">
              {t("লগইন", "Sign in")}
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
