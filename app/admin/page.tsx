import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AccountsTable, ResetDemoButton } from "@/components/admin/AdminActions";
import { NotAllowed } from "@/components/auth/NotAllowed";
import { requirePageRole } from "@/lib/auth/guard";
import { verifyAuditChain } from "@/lib/engines/audit";
import { recentActivity } from "@/lib/engines/demo";
import { listAccounts, officeSummary, recentAudit } from "@/lib/engines/office";

export const metadata: Metadata = { title: "অফিস ও প্রশাসন" };

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

export default function AdminPage() {
  return (
    <>
      <PageHeader
        titleBn="অফিস ও প্রশাসন"
        titleEn="Office and admin view"
        subtitleBn="আজকের নিবন্ধন, নামজারি, সিলযুক্ত রিপোর্ট ও অডিট লগ — এক নজরে।"
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-ink-soft">লোড হচ্ছে… Loading…</p>}>
          <Content />
        </Suspense>
      </main>
    </>
  );
}

async function Content() {
  await connection();
  const { user, ok } = await requirePageRole("officer", "/admin");
  if (!ok) return <NotAllowed need="officer" />;
  const isAdmin = user.role === "admin";
  const [summary, chain, audit, activity, accounts] = await Promise.all([
    officeSummary(),
    verifyAuditChain(),
    recentAudit(user, 20),
    recentActivity(),
    isAdmin ? listAccounts() : Promise.resolve(null),
  ]);

  const tiles = [
    { bn: "দাগ", n: summary.dags },
    { bn: "নিবন্ধিত লেনদেন", n: summary.accepted },
    { bn: "আটকানো লেনদেন", n: summary.refused },
    { bn: "অপেক্ষমাণ নামজারি", n: summary.pending_mutations },
    { bn: "সিলযুক্ত রিপোর্ট", n: summary.seals },
    { bn: "অডিট এন্ট্রি", n: summary.audit_entries },
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="today" className="space-y-2">
        <h2 id="today" className="text-lg font-semibold">
          এক নজরে
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="office-tiles">
          {tiles.map((t) => (
            <li key={t.bn} className="rounded-xl border border-line bg-card p-3">
              <p className="text-2xl font-bold">{bn(t.n)}</p>
              <p className="text-sm text-ink-soft">{t.bn}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        data-testid="chain-status"
        data-ok={chain.ok}
        className={`rounded-xl border p-3 ${chain.ok ? "border-verdict-green/40 bg-green-50" : "border-verdict-red/40 bg-red-50"}`}
      >
        <p className="font-semibold">
          {chain.ok
            ? `অডিট লগের শৃঙ্খল অক্ষত — ${bn(chain.entries)}টি এন্ট্রি যাচাই হয়েছে`
            : `অডিট লগের শৃঙ্খল ভাঙা: এন্ট্রি ${bn(chain.broken_at ?? 0)} — অবিলম্বে তদন্ত করুন`}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="mut" className="space-y-2">
          <h2 id="mut" className="text-lg font-semibold">
            নামজারি মামলা
          </h2>
          {activity.mutations.length === 0 ? (
            <p className="rounded-xl border border-line bg-card p-3 text-ink-soft">
              এখনও কোনো নামজারি মামলা নেই। সাব-রেজিস্ট্রিতে দলিল নিবন্ধন হলে এখানে দেখাবে।
            </p>
          ) : (
            <ul className="space-y-2">
              {activity.mutations.map((m) => (
                <li key={m.case_no} className="rounded-xl border border-line bg-card p-3 text-sm">
                  <p className="font-medium">
                    {m.case_no}: {m.mouza_bn}, দাগ {bn(m.dag_no)} — {bn(m.area_dec)} শতক
                  </p>
                  <p className="text-ink-soft">
                    {m.from_bn} → {m.to_bn} · শেষ তারিখ {bn(m.deadline_on)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="audit" className="space-y-2">
          <h2 id="audit" className="text-lg font-semibold">
            সাম্প্রতিক অডিট লগ
          </h2>
          {audit.length === 0 ? (
            <p className="rounded-xl border border-line bg-card p-3 text-ink-soft">
              অডিট লগ এখন খালি (ডেমো রিসেটের পরে)।
            </p>
          ) : (
            <ol className="space-y-1 text-sm" data-testid="office-audit">
              {audit.map((a) => (
                <li key={a.id} className="rounded-lg border border-line bg-card px-3 py-2">
                  <span className="font-medium">{a.role_bn}</span> {a.action_bn}
                  {a.place_bn
                    ? ` · ${a.place_bn.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!)}`
                    : ""}
                  <span className="block text-ink-soft">{bn(a.at)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {isAdmin && accounts ? (
        <section
          aria-labelledby="admin"
          className="space-y-3 rounded-xl border border-line bg-card p-4"
        >
          <h2 id="admin" className="text-lg font-semibold">
            প্রশাসক{" "}
            <span lang="en" className="text-sm font-normal text-ink-soft">
              Admin only
            </span>
          </h2>
          <AccountsTable accounts={accounts} />
          <ResetDemoButton />
        </section>
      ) : null}
    </div>
  );
}
