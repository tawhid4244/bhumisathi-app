"use client";

import Link from "next/link";
import { useState } from "react";

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
  const [error, setError] = useState<{ bn: string; login?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

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
        setError({ bn: "সিলযুক্ত রিপোর্ট নিতে লগইন করুন।", login: true });
      } else if (!res.ok) {
        setError({ bn: json?.error?.bn ?? "রিপোর্ট তৈরি করা যায়নি।" });
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
        সিলযুক্ত রিপোর্ট (BhumiSeal)
      </h3>
      <p className="text-sm text-ink-soft">
        ডিজিটাল স্বাক্ষর করা QR কোড — ব্যাংক বা ক্রেতা স্ক্যান করে যাচাই করতে পারবেন রিপোর্টটি আসল ও
        হালনাগাদ কি না।
      </p>
      {!seal ? (
        <button
          type="button"
          onClick={issue}
          disabled={busy}
          className="mt-2 min-h-11 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "তৈরি হচ্ছে…" : "সিলযুক্ত রিপোর্ট নিন"}
        </button>
      ) : (
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row">
          {/* The QR is an image from an SVG made on our server; as an <img> it cannot run code. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(seal.qr_svg)}`}
            alt="যাচাইয়ের QR কোড — স্ক্যান করলে /verify পাতা খুলবে"
            width={200}
            height={200}
            className="h-auto w-48 max-w-full rounded border border-line bg-white"
            data-testid="seal-qr"
          />
          <div className="min-w-0 space-y-2 text-sm">
            <p>স্বাক্ষরের সময়: {new Date(seal.payload.issued_at).toLocaleString("bn-BD")}</p>
            <Link
              href={`/verify#${seal.code}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-brand px-3 text-brand"
              data-testid="seal-verify-link"
            >
              এখনই যাচাই করুন
            </Link>
            <details>
              <summary className="cursor-pointer">কোডটি দেখুন (কাগজে না থাকলে)</summary>
              <p className="mt-1 break-all font-mono text-xs" data-testid="seal-code">
                {seal.code}
              </p>
            </details>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-verdict-red">
          {error.bn}{" "}
          {error.login ? (
            <Link href={`/login?next=${encodeURIComponent(here)}`} className="underline">
              লগইন
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
