"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { METHOD_LABEL, PAYMENT_METHODS, type PaymentMethod } from "@/lib/adapters/payment";
import { APPLICATION_TYPES, type ApplicationTypeId } from "@/lib/services/catalog";
import { T, useLang, useNum } from "../i18n/LangProvider";

// Small client pieces for the application pages: pay (sandbox) / cancel, officer decision,
// mark notifications read, print. Each calls one tool through /api/tools and refreshes the page.

type ApiReply = { error?: { bn: string; en: string } } | null;

async function callTool(name: string, body: unknown): Promise<{ ok: boolean; json: ApiReply }> {
  const res = await fetch(`/api/tools/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, json: await res.json().catch(() => null) };
}

function useErr() {
  const { lang, t } = useLang();
  const [error, setError] = useState<string | null>(null);
  const fail = (json: { error?: { bn: string; en: string } } | null) =>
    setError(json?.error ? (lang === "en" ? json.error.en : json.error.bn) : t("দুঃখিত, একটি সমস্যা হয়েছে।", "Sorry, something went wrong.")); // prettier-ignore
  const box = error ? (
    <p role="alert" className="mt-3 rounded-lg border border-verdict-red/40 bg-red-50 p-3 text-sm">
      {error}
    </p>
  ) : null;
  return { fail, box, clear: () => setError(null) };
}

export function PayPanel({
  appNo,
  amount,
  final = false,
}: {
  appNo: string;
  amount: number;
  /** The second fee after approval (mutation DCR): no cancelling any more. */
  final?: boolean;
}) {
  const { t } = useLang();
  const num = useNum();
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("bkash");
  const [busy, setBusy] = useState(false);
  const { fail, box, clear } = useErr();

  async function run(tool: "application_pay" | "application_cancel") {
    setBusy(true);
    clear();
    const r = await callTool(tool, tool === "application_pay" ? { app_no: appNo, method } : { app_no: appNo }); // prettier-ignore
    setBusy(false);
    if (!r.ok) return fail(r.json);
    router.refresh();
  }

  return (
    <section
      className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4"
      aria-labelledby="pay-h"
      data-testid="pay-panel"
    >
      <h2 id="pay-h" className="text-lg font-semibold">
        {final
          ? t(`শেষ ফি (ডিসিআর) পরিশোধ: ৳${num(amount)}`, `Pay the final (DCR) fee: Tk ${amount}`)
          : t(`ফি পরিশোধ: ৳${num(amount)}`, `Pay the fee: Tk ${amount}`)}
      </h2>
      <p className="mt-1 text-sm">
        <strong>{t("পরীক্ষামূলক (sandbox) পেমেন্ট।", "Sandbox payment.")}</strong>{" "}
        {t(
          "কোনো আসল টাকা কাটা হবে না, কোনো কার্ড বা ওয়ালেট নম্বর চাওয়া হবে না।",
          "No real money moves and no card or wallet number is asked for.",
        )}
      </p>
      <div
        className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
        role="radiogroup"
        aria-label={t("পেমেন্ট মাধ্যম", "Payment method")}
      >
        {PAYMENT_METHODS.map((m) => (
          <label
            key={m}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 ${method === m ? "border-brand bg-white font-semibold" : "border-line bg-white/70"}`}
          >
            <input
              type="radio"
              name="method"
              checked={method === m}
              onChange={() => setMethod(m)}
            />
            <T bn={METHOD_LABEL[m].bn} en={METHOD_LABEL[m].en} />
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run("application_pay")}
          disabled={busy}
          className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {busy
            ? t("অপেক্ষা করুন…", "Please wait…")
            : t(`৳${num(amount)} পরিশোধ করুন (পরীক্ষা)`, `Pay Tk ${amount} (test)`)}
        </button>
        {final ? null : (
          <button
            type="button"
            onClick={() => run("application_cancel")}
            disabled={busy}
            className="min-h-11 rounded-lg border border-line bg-white px-4 font-semibold disabled:opacity-60"
          >
            {t("আবেদন বাতিল", "Cancel application")}
          </button>
        )}
      </div>
      {box}
    </section>
  );
}

/**
 * Officer buttons. Copy: approve issues it · mutation: call a hearing, approve (DCR fee then due)
 * · complaint: resolve, with what was done (required, the citizen sees it). Reject needs a reason.
 */
export function DecideButtons({
  appNo,
  type = "certified_copy",
  canHear = false,
}: {
  appNo: string;
  type?: ApplicationTypeId;
  canHear?: boolean;
}) {
  const { t } = useLang();
  const router = useRouter();
  const def = APPLICATION_TYPES[type];
  const resolveNeedsNote = type === "complaint";
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const { fail, box, clear } = useErr();

  async function call(tool: string, body: unknown) {
    setBusy(true);
    clear();
    const r = await callTool(tool, body);
    setBusy(false);
    if (!r.ok) return fail(r.json);
    router.refresh();
  }
  const decide = (decision: "approve" | "reject") =>
    call("application_decide", { app_no: appNo, decision, note: note.trim() || undefined });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => (resolveNeedsNote ? setOpen(open === "approve" ? null : "approve") : decide("approve"))} // prettier-ignore
          disabled={busy}
          aria-expanded={resolveNeedsNote ? open === "approve" : undefined}
          className="min-h-11 rounded-lg bg-verdict-green px-4 font-semibold text-white disabled:opacity-60"
        >
          <T bn={def.approve_bn} en={def.approve_en} />
        </button>
        {canHear ? (
          <button
            type="button"
            onClick={() => call("application_hearing", { app_no: appNo })}
            disabled={busy}
            className="min-h-11 rounded-lg border border-brand bg-white px-4 font-semibold text-brand-deep disabled:opacity-60"
          >
            {t("শুনানি ডাকুন (৭ দিন পর)", "Call a hearing (in 7 days)")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(open === "reject" ? null : "reject")}
          disabled={busy}
          aria-expanded={open === "reject"}
          className="min-h-11 rounded-lg border border-verdict-red/60 bg-white px-4 font-semibold text-verdict-red disabled:opacity-60"
        >
          {type === "complaint" ? t("বন্ধ করুন", "Close") : t("নামঞ্জুর", "Reject")}
        </button>
      </div>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="grid flex-1 gap-1 text-sm font-medium">
            {open === "approve"
              ? t("কী ব্যবস্থা নেওয়া হয়েছে (নাগরিক দেখবেন)", "What was done (the citizen sees it)")
              : t("কারণ (নাগরিক দেখবেন)", "Reason (the citizen sees it)")}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
            />
          </label>
          <button
            type="button"
            onClick={() => decide(open)}
            disabled={busy || !note.trim()}
            className={`min-h-11 self-end rounded-lg px-4 font-semibold text-white disabled:opacity-50 ${open === "approve" ? "bg-verdict-green" : "bg-verdict-red"}`}
          >
            {open === "approve" ? t("নিষ্পত্তি নিশ্চিত করুন", "Confirm") : t("নিশ্চিত করুন", "Confirm")}
          </button>
        </div>
      ) : null}
      {box}
    </div>
  );
}

export function MarkReadButton() {
  const { t } = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await callTool("notifications", { mark_read: true });
        setBusy(false);
        router.refresh();
      }}
      className="min-h-9 rounded-lg border border-line bg-white px-3 text-sm font-semibold disabled:opacity-60"
    >
      {t("সব পড়া হয়েছে", "Mark all read")}
    </button>
  );
}

export function PrintButton() {
  const { t } = useLang();
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 rounded-lg border border-line bg-white px-4 font-semibold print:hidden"
    >
      {t("প্রিন্ট / PDF", "Print / PDF")}
    </button>
  );
}
