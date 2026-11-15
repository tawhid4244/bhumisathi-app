"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MouzaOption } from "@/lib/engines/mouzas";
import { useLang } from "../i18n/LangProvider";
import { IconArrow } from "../ui/icons";

// The hero's "check a dag" box: mouza + dag number → the full Jomi Check report.
const bnDigits = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
const western = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

export function QuickCheck({ mouzas }: { mouzas: MouzaOption[] }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const [mouza, setMouza] = useState(mouzas[0]?.code.toLowerCase() ?? "nay");
  const [dag, setDag] = useState("");
  const [error, setError] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(western(dag.trim()));
        if (!Number.isInteger(n) || n <= 0) return setError(true);
        router.push(`/check?mouza=${mouza}&by=dag&no=${n}`);
      }}
      className="rounded-2xl bg-card p-4 text-ink shadow-xl ring-1 ring-black/5 sm:p-5"
      aria-label={t("দ্রুত জমি যাচাই", "Quick land check")}
    >
      <p className="font-semibold">{t("এখনই জমি যাচাই করুন", "Check a plot now")}</p>
      <p className="text-sm text-ink-soft">
        {t(
          "কেনার আগে দেখে নিন: দায়, মামলা, খাস, আগের বিক্রি।",
          "Before you buy: liens, cases, khas land, earlier sales.",
        )}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
        <label className="block min-w-0">
          <span className="sr-only">{t("মৌজা", "Mouza")}</span>
          <select
            value={mouza}
            onChange={(e) => setMouza(e.target.value)}
            className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-paper px-3"
          >
            {mouzas.map((m) => (
              <option key={m.code} value={m.code.toLowerCase()}>
                {lang === "en"
                  ? `${m.name_en} (JL ${m.jl_no})`
                  : `${m.name_bn} (জে.এল. ${bnDigits(m.jl_no)})`}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="sr-only">{t("দাগ নম্বর", "Dag number")}</span>
          <input
            value={dag}
            onChange={(e) => {
              setDag(e.target.value);
              setError(false);
            }}
            inputMode="numeric"
            placeholder={t("দাগ নং, যেমন ১৪৫", "Dag no., e.g. 145")}
            aria-invalid={error}
            className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-paper px-3"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          {t("যাচাই", "Check")}
          <IconArrow />
        </button>
      </div>
      {error ? (
        <p role="status" className="mt-2 text-sm text-verdict-red">
          {t("সঠিক দাগ নম্বর লিখুন (যেমন ১৪৫)।", "Enter a valid dag number, e.g. 145.")}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-soft">
          {t(
            "চেষ্টা করুন: ১৪১ (সবুজ), ১৪২ (মামলা), ১৪৫ (বায়না), ১৪৯ (খাস)",
            "Try: 141 (green), 142 (court case), 145 (baina), 149 (khas)",
          )}
        </p>
      )}
    </form>
  );
}
