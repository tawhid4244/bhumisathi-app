"use client";

import type { MouzaOption } from "@/lib/engines/mouzas";
import { useLang, useNum } from "../i18n/LangProvider";

interface Props {
  mouzas: MouzaOption[];
  mouza?: string;
  by?: "dag" | "khatian";
  no?: string;
}

// Plain HTML GET form: works without JavaScript and puts the search in the URL,
// so a report link can be shared or opened from another page.
export function SearchForm({ mouzas, mouza, by = "dag", no }: Props) {
  const { t, lang } = useLang();
  const num = useNum();
  return (
    <form
      method="get"
      action="/check"
      className="rounded-xl border border-line bg-card p-4 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm font-medium">
          {t("মৌজা", "Mouza")}
          <select
            name="mouza"
            defaultValue={mouza ?? mouzas[0]?.code.toLowerCase()}
            className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
          >
            {mouzas.map((m) => (
              <option key={m.code} value={m.code.toLowerCase()}>
                {lang === "en"
                  ? `${m.name_en} (JL ${m.jl_no})`
                  : `${m.name_bn} (জেএল ${num(m.jl_no)})`}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t("কী দিয়ে খুঁজবেন", "Search by")}
          <select
            name="by"
            defaultValue={by}
            className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
          >
            <option value="dag">{t("দাগ নম্বর", "Dag number")}</option>
            <option value="khatian">{t("খতিয়ান নম্বর (বিএস)", "Khatian number (BS)")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t("নম্বর", "Number")}
          <input
            name="no"
            defaultValue={no}
            required
            inputMode="numeric"
            pattern="[0-9০-৯]{1,5}"
            placeholder={t("যেমন ১৪৫", "e.g. 145")}
            className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand/90"
        >
          {t("যাচাই করুন", "Check")}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        {t(
          "মৌজা বেছে দাগ বা বিএস খতিয়ান নম্বর লিখুন — বাংলা বা ইংরেজি অঙ্ক দুটোই চলবে।",
          "Choose a mouza, then enter a dag or BS khatian number. Bangla or English digits both work.",
        )}
      </p>
    </form>
  );
}
