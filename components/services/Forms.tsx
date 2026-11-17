"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_LABEL, COMPLAINT_CATEGORIES, type ComplaintCategory } from "@/lib/services/catalog"; // prettier-ignore
import { T, useLang, useNum } from "../i18n/LangProvider";

// Application forms for mutation and complaints (the certified copy has its own wizard).
// Each posts to /api/tools/application_submit and opens the new application's page.

type Reply = { app_no?: string; error?: { bn: string; en: string } } | null;

function useSubmit() {
  const { t, lang } = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tools/application_submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as Reply;
    setBusy(false);
    if (!res.ok || !json?.app_no) {
      setError(json?.error ? (lang === "en" ? json.error.en : json.error.bn) : t("দুঃখিত, জমা হয়নি।", "Sorry, it was not submitted.")); // prettier-ignore
      return;
    }
    router.push(`/my/applications/${json.app_no}`);
  }
  const box = error ? (
    <p role="alert" className="mt-3 rounded-lg border border-verdict-red/40 bg-red-50 p-3 text-sm">
      {error}
    </p>
  ) : null;
  return { submit, busy, box };
}

const input = "min-h-11 rounded-lg border border-line bg-white px-3 text-base";

export function MutationForm({
  fees,
}: {
  fees: { bn: string; en: string; tk: number; stage?: string }[];
}) {
  // prettier-ignore
  const { t } = useLang();
  const num = useNum();
  const [deed, setDeed] = useState("");
  const [sure, setSure] = useState(false);
  const { submit, busy, box } = useSubmit();
  const now = fees.filter((f) => f.stage !== "approval");
  const later = fees.filter((f) => f.stage === "approval");
  const sum = (l: typeof fees) => l.reduce((s, f) => s + f.tk, 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit({ type: "mutation", details: { deed_no: deed } });
      }}
      className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6"
      data-testid="mutation-form"
    >
      <label className="grid gap-1 text-sm font-medium">
        {t("নিবন্ধিত বিক্রয় দলিলের নম্বর", "Registered sale deed number")}
        <input
          value={deed}
          onChange={(e) => setDeed(e.target.value)}
          placeholder={t("যেমন ৫০০১/২০২৬", "e.g. 5001/2026")}
          className={input}
          required
        />
        <span className="text-xs font-normal text-ink-soft">
          {t(
            "দলিল থেকে বিক্রেতা, ক্রেতা, দাগ ও জমির পরিমাণ নিজে থেকেই আসবে।",
            "The seller, buyer, dag and area are taken from the deed.",
          )}{" "}
          {/* prettier-ignore */}
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-3">
          <h2 className="text-sm font-semibold">
            {t(`এখন: ৳${num(sum(now))}`, `Now: Tk ${sum(now)}`)}
          </h2>
          <ul className="mt-1 text-sm">
            {now.map((f) =>
              <li key={f.en} className="flex justify-between gap-2"><T bn={f.bn} en={f.en} /><span>{t(`৳${num(f.tk)}`, `Tk ${f.tk}`)}</span></li>, // prettier-ignore
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-line bg-white p-3">
          <h2 className="text-sm font-semibold">
            {t(
              `অনুমোদনের পর (ডিসিআর): ৳${num(sum(later))}`,
              `After approval (DCR): Tk ${sum(later)}`,
            )}
          </h2>{" "}
          {/* prettier-ignore */}
          <ul className="mt-1 text-sm">
            {later.map((f) => (
              <li key={f.en} className="flex justify-between gap-2"><T bn={f.bn} en={f.en} /><span>{t(`৳${num(f.tk)}`, `Tk ${f.tk}`)}</span></li> // prettier-ignore
            ))}
          </ul>
        </section>
      </div>
      <p className="text-sm text-ink-soft">
        {t(
          "ধাপ: আবেদন → ফি → এসি ল্যান্ড অফিসে যাচাই ও প্রয়োজনে শুনানি → আদেশ → ডিসিআর ফি → নতুন খতিয়ান। সরকারি মোট ফি ৳১,১৭০ — এর বেশি কেউ চাইলে অভিযোগ করুন।",
          "Steps: apply → fee → AC Land review and, if needed, a hearing → order → DCR fee → new khatian. The official total is Tk 1,170 — report anyone who asks for more.",
        )}{" "}
        {/* prettier-ignore */}
      </p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
        {t(
          "দলিলের কপি, বিক্রেতার খতিয়ান ও দাখিলা হাতে আছে।",
          "I have the deed copy, the seller's khatian and the dakhila.",
        )}{" "}
        {/* prettier-ignore */}
      </label>
      <button
        type="submit"
        disabled={busy || !sure || deed.trim().length < 6}
        className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
      >
        {busy
          ? t("জমা হচ্ছে…", "Submitting…")
          : t("নামজারির আবেদন জমা দিন", "Submit mutation application")}
      </button>
      {box}
    </form>
  );
}

export function ComplaintForm({ suggest }: { suggest?: string }) {
  const { t } = useLang();
  const [category, setCategory] = useState<ComplaintCategory | "">("");
  const [text, setText] = useState(suggest ?? "");
  const [dag, setDag] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const { submit, busy, box } = useSubmit();
  const dagNo = Number(dag.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit({
          type: "complaint",
          details: {
            text,
            anonymous,
            ...(category ? { category } : {}),
            ...(dagNo > 0 ? { dag_no: dagNo } : {}),
          },
        });
      }}
      className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6"
      data-testid="complaint-form"
    >
      <label className="grid gap-1 text-sm font-medium">
        {t("কী হয়েছে? নিজের ভাষায় লিখুন", "What happened? In your own words")}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={1000}
          required
          placeholder={t("যেমন: নামজারির জন্য দালাল ৫,০০০ টাকা চেয়েছে", "e.g. A broker asked for Tk 5,000 for my mutation")} // prettier-ignore
          className="rounded-lg border border-line bg-white p-3 text-base"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          {t("ধরন (না বাছলে আমরা ঠিক করব)", "Type (we choose if you leave it)")}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ComplaintCategory | "")}
            className={input}
          >
            {" "}
            {/* prettier-ignore */}
            <option value="">{t("— নিজে থেকে —", "— automatic —")}</option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(CATEGORY_LABEL[c].bn, CATEGORY_LABEL[c].en)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t("দাগ নম্বর (থাকলে)", "Dag number (if any)")}
          <input
            value={dag}
            onChange={(e) => setDag(e.target.value)}
            inputMode="numeric"
            className={input}
          />{" "}
          {/* prettier-ignore */}
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
        />
        {t(
          "নাম গোপন রাখুন (অফিস আপনার নাম দেখবে না; অবস্থা আপনি দেখতে পাবেন)",
          "Keep my name hidden (the office will not see it; you still see the status)",
        )}{" "}
        {/* prettier-ignore */}
      </label>
      <button
        type="submit"
        disabled={busy || text.trim().length < 5}
        className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
      >
        {busy ? t("জমা হচ্ছে…", "Submitting…") : t("অভিযোগ জমা দিন", "Submit complaint")}
      </button>
      <p className="text-xs text-ink-soft">
        {t("জরুরি হলে: ভূমি সেবা হেল্পলাইন ১৬১২২।", "Urgent: land service helpline 16122.")}
      </p>
      {box}
    </form>
  );
}
