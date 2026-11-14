"use client";

import { useCallback, useState } from "react";
import type { Activity, Person } from "@/lib/engines/demo";
import type { JomiReport } from "@/lib/engines/jomi-check";
import type { LedgerStatus, RegisterResult } from "@/lib/engines/ledger";
import type { MouzaOption } from "@/lib/engines/mouzas";
import { bn } from "@/lib/engines/rules";
import { VerdictIcon } from "../VerdictIcon";

// The sub-registrar's desk. Every number and decision comes from the registry tools
// (ledger_status, jomi_check, register_*); this component only shows them and asks for a
// read-back confirmation before any write.

type Action = "sale" | "baina" | "lien";
const ACTION_BN: Record<Action, string> = { sale: "বিক্রয় দলিল", baina: "বায়না", lien: "বন্ধক" };
const EVENT_BN: Record<string, string> = { sale: "বিক্রি", baina: "বায়না", lien: "বন্ধক" };
const TOOL: Record<Action, string> = {
  sale: "register_sale",
  baina: "register_baina",
  lien: "register_lien",
};

async function callTool<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/tools/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.bn ?? "সমস্যা হয়েছে");
  return json as T;
}

const VERDICT_BG = {
  red: "bg-verdict-red",
  amber: "bg-verdict-amber",
  green: "bg-verdict-green",
} as const;

const field = "min-h-11 w-full rounded-lg border border-line bg-white px-3 text-base";

export function RegistryDesk({
  mouzas,
  people,
  initialActivity,
}: {
  mouzas: MouzaOption[];
  people: Person[];
  initialActivity: Activity;
}) {
  const [mouza, setMouza] = useState(mouzas[0]?.code.toLowerCase() ?? "nay");
  const [dagNo, setDagNo] = useState("145");
  const [status, setStatus] = useState<LedgerStatus | null>(null);
  const [action, setAction] = useState<Action>("sale");
  const [sellerId, setSellerId] = useState<number | "">("");
  const [buyerId, setBuyerId] = useState<number | "">("");
  const [area, setArea] = useState("");
  const [days, setDays] = useState("90");
  const [report, setReport] = useState<JomiReport | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<Activity>(initialActivity);

  const refreshActivity = useCallback(async () => {
    const res = await fetch("/api/demo/activity", { cache: "no-store" });
    if (res.ok) setActivity(await res.json());
  }, []);

  const dagNumber = Number(dagNo.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));
  const areaNumber = Number(area.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));
  const counterparties = people.filter((p) =>
    action === "lien" ? p.kind === "bank" : p.kind === "person",
  );
  const seller = status?.holders.find((h) => h.owner_id === sellerId);
  const buyer = people.find((p) => p.id === buyerId);

  async function loadDag(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setReport(null);
    setResult(null);
    setConfirming(false);
    try {
      const s = await callTool<LedgerStatus>("ledger_status", { mouza, dag_no: dagNumber });
      setStatus(s);
      setSellerId(s.holders[0]?.owner_id ?? "");
    } catch (err) {
      setStatus(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!status || sellerId === "" || buyerId === "" || !(areaNumber > 0)) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await callTool<JomiReport>("jomi_check", {
        mouza,
        dag_no: dagNumber,
        seller_id: sellerId,
        area_dec: areaNumber,
      });
      setReport(r);
      setConfirming(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    if (sellerId === "" || buyerId === "") return;
    setBusy(true);
    setError(null);
    try {
      const base = { mouza, dag_no: dagNumber, area_dec: areaNumber };
      const body =
        action === "lien"
          ? { ...base, owner_id: sellerId, lender_id: buyerId }
          : action === "baina"
            ? { ...base, seller_id: sellerId, buyer_id: buyerId, days: Number(days) || 90 }
            : { ...base, seller_id: sellerId, buyer_id: buyerId };
      const r = await callTool<RegisterResult>(TOOL[action], body);
      setResult(r);
      setConfirming(false);
      setStatus(await callTool<LedgerStatus>("ledger_status", { mouza, dag_no: dagNumber }));
      await refreshActivity();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetDemo() {
    setBusy(true);
    try {
      await fetch("/api/demo/reset", { method: "POST" });
      setResult(null);
      setReport(null);
      setConfirming(false);
      setStatus(null);
      await refreshActivity();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        {/* Step 1: dag */}
        <form onSubmit={loadDag} className="rounded-xl border border-line bg-card p-4 shadow-sm">
          <h2 className="font-semibold">১. দাগ নির্বাচন</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-medium">
              মৌজা
              <select value={mouza} onChange={(e) => setMouza(e.target.value)} className={field}>
                {mouzas.map((m) => (
                  <option key={m.code} value={m.code.toLowerCase()}>
                    {m.name_bn} (জেএল {bn(m.jl_no)})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              দাগ নম্বর
              <input
                value={dagNo}
                onChange={(e) => setDagNo(e.target.value)}
                inputMode="numeric"
                className={field}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-lg bg-ink px-4 font-semibold text-white disabled:opacity-60"
            >
              লেজার দেখুন
            </button>
          </div>
          {status ? (
            <div className="mt-3 rounded-lg bg-paper p-3 text-sm" data-testid="ledger-summary">
              <p className="font-medium">
                {status.dag.mouza_bn} দাগ {bn(status.dag.dag_no)} · আয়তন{" "}
                {bn(status.dag.recorded_area_dec)} শতক · লেজার সংস্করণ {bn(status.dag.version)}
              </p>
              <ul className="mt-1 space-y-0.5">
                {status.holders.map((h) => (
                  <li key={h.owner_id}>
                    {h.name_bn}: রেকর্ডীয় {bn(h.recorded_dec)}, বিক্রয়যোগ্য{" "}
                    <strong data-testid={`desk-sellable-${h.owner_id}`}>
                      {bn(h.sellable_dec)} শতক
                    </strong>
                  </li>
                ))}
              </ul>
              {status.active_bainas.map((b) => (
                <p key={b.id} className="text-verdict-amber">
                  বায়না {b.id}: {bn(b.area_dec)} শতক, {b.buyer_bn}, মেয়াদ {bn(b.expires_on)}
                </p>
              ))}
              {status.active_liens.map((l) => (
                <p key={l.id} className="text-verdict-amber">
                  বন্ধক {l.id}: {bn(l.area_dec)} শতক, {l.lender_bn}
                </p>
              ))}
            </div>
          ) : null}
        </form>

        {/* Step 2: transaction */}
        {status ? (
          <form onSubmit={runCheck} className="rounded-xl border border-line bg-card p-4 shadow-sm">
            <h2 className="font-semibold">২. লেনদেনের তথ্য</h2>
            <fieldset className="mt-3">
              <legend className="text-sm font-medium">ধরন</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {(Object.keys(ACTION_BN) as Action[]).map((a) => (
                  <label
                    key={a}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 ${
                      action === a ? "border-brand bg-brand-soft" : "border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="action"
                      value={a}
                      checked={action === a}
                      onChange={() => {
                        setAction(a);
                        setBuyerId("");
                        setConfirming(false);
                      }}
                    />
                    {ACTION_BN[a]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                {action === "lien" ? "জমির মালিক (ঋণগ্রহীতা)" : "বিক্রেতা"}
                <select
                  value={sellerId}
                  onChange={(e) => setSellerId(Number(e.target.value))}
                  className={field}
                >
                  {status.holders.map((h) => (
                    <option key={h.owner_id} value={h.owner_id}>
                      {h.name_bn}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                {action === "lien" ? "ব্যাংক" : "ক্রেতা"}
                <select
                  value={buyerId}
                  onChange={(e) => setBuyerId(e.target.value ? Number(e.target.value) : "")}
                  className={field}
                  required
                >
                  <option value="">বেছে নিন…</option>
                  {counterparties
                    .filter((p) => p.id !== sellerId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name_bn}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                জমির পরিমাণ (শতক)
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  inputMode="decimal"
                  required
                  className={field}
                />
              </label>
              {action === "baina" ? (
                <label className="grid gap-1 text-sm font-medium">
                  বায়নার মেয়াদ (দিন)
                  <input
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    inputMode="numeric"
                    className={field}
                  />
                </label>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={busy || buyerId === "" || !(areaNumber > 0)}
              className="mt-4 min-h-11 w-full rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60 sm:w-auto"
            >
              জমি যাচাই করুন
            </button>
          </form>
        ) : null}

        {/* Step 3: check result + read-back confirmation */}
        {report && confirming ? (
          <section
            aria-label="যাচাইয়ের ফল ও নিশ্চিতকরণ"
            className="rounded-xl border border-line bg-card p-4 shadow-sm"
          >
            <div
              className={`flex items-center gap-3 rounded-lg p-3 text-white ${VERDICT_BG[report.verdict]}`}
              data-desk-verdict={report.verdict}
            >
              <VerdictIcon verdict={report.verdict} className="h-8 w-8 shrink-0" />
              <div>
                <p className="font-bold">{report.verdict_bn}</p>
                <p className="text-sm">{report.reasons[0]?.bn}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-paper p-3">
              <p className="font-semibold">৩. সংখ্যাগুলো আবার মিলিয়ে নিন</p>
              <p className="mt-1" data-testid="readback">
                {ACTION_BN[action]}: {status?.dag.mouza_bn} দাগ {bn(dagNumber)}, {seller?.name_bn} →{" "}
                {buyer?.name_bn}, {bn(areaNumber)} শতক
                {action === "baina" ? `, ${bn(days)} দিন` : ""}। ঠিক আছে?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={register}
                  disabled={busy}
                  className="min-h-11 rounded-lg bg-ink px-4 font-semibold text-white disabled:opacity-60"
                >
                  হ্যাঁ, নিবন্ধন করুন
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="min-h-11 rounded-lg border border-line px-4"
                >
                  বাতিল
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* Outcome */}
        {result ? (
          <section
            role="status"
            data-result={result.ok ? "ok" : "blocked"}
            className={`rounded-xl p-4 text-white shadow-sm ${
              result.ok ? "bg-verdict-green" : "bg-verdict-red"
            }`}
          >
            {result.ok ? (
              <>
                <p className="text-xl font-bold">নিবন্ধিত হয়েছে</p>
                <p>
                  নম্বর: <strong>{result.ref}</strong>
                  {result.mutation_case ? (
                    <>
                      {" "}
                      · নামজারি মামলা <strong>{result.mutation_case}</strong> খোলা হয়েছে (২৮ দিন)
                    </>
                  ) : null}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold">দলিল আটকানো হয়েছে</p>
                <p>{result.reason_bn}</p>
                <p lang="en" className="mt-1 text-sm opacity-90">
                  {result.reason_en}
                </p>
              </>
            )}
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl border border-verdict-red/40 bg-red-50 p-3">
            {error}
          </p>
        ) : null}
      </div>

      {/* Live activity */}
      <aside className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">সরাসরি কার্যক্রম</h2>
          <button
            type="button"
            onClick={resetDemo}
            disabled={busy}
            className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
          >
            ডেমো রিসেট
          </button>
        </div>

        <section aria-labelledby="sms-title" className="rounded-xl border border-line bg-card p-3">
          <h3 id="sms-title" className="font-medium">
            মোবাইল বার্তা (ডেমো)
          </h3>
          <p className="text-xs text-ink-soft">কোনো আসল এসএমএস পাঠানো হয় না। Mock SMS log.</p>
          <ul className="mt-2 space-y-2 text-sm" data-testid="sms-log">
            {activity.sms.length ? (
              activity.sms.map((s) => (
                <li key={s.id} className="rounded-lg bg-paper p-2">
                  <p className="text-xs text-ink-soft">
                    {s.name_bn} · {s.phone} · {bn(s.at)}
                  </p>
                  <p>{s.body_bn}</p>
                </li>
              ))
            ) : (
              <li className="text-ink-soft">এখনও কোনো বার্তা নেই।</li>
            )}
          </ul>
        </section>

        <section aria-labelledby="mut-title" className="rounded-xl border border-line bg-card p-3">
          <h3 id="mut-title" className="font-medium">
            নামজারি মামলা
          </h3>
          <ul className="mt-2 space-y-1 text-sm" data-testid="mutation-list">
            {activity.mutations.length ? (
              activity.mutations.map((m) => (
                <li key={m.case_no}>
                  <strong>{m.case_no}</strong>: {m.mouza_bn} দাগ {bn(m.dag_no)}, {m.from_bn} →{" "}
                  {m.to_bn}, {bn(m.area_dec)} শতক · অপেক্ষমাণ · শেষ তারিখ {bn(m.deadline_on)}
                </li>
              ))
            ) : (
              <li className="text-ink-soft">কোনো মামলা নেই।</li>
            )}
          </ul>
        </section>

        <section aria-labelledby="ev-title" className="rounded-xl border border-line bg-card p-3">
          <h3 id="ev-title" className="font-medium">
            লেজার ঘটনা
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {activity.events.length ? (
              activity.events.map((e) => (
                <li key={e.id}>
                  {bn(e.at)} · দাগ {bn(e.dag_no)} · {EVENT_BN[e.event_type] ?? e.event_type}{" "}
                  {bn(e.area_dec)} শতক ·{" "}
                  <span
                    className={
                      e.status === "accepted"
                        ? "text-verdict-green"
                        : "font-semibold text-verdict-red"
                    }
                  >
                    {e.status === "accepted" ? `গৃহীত ${e.ref ?? ""}` : "আটকানো"}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-ink-soft">কোনো ঘটনা নেই।</li>
            )}
          </ul>
        </section>
      </aside>
    </div>
  );
}
