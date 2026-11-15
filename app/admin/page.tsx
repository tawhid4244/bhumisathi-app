import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AccountsTable, ResetDemoButton } from "@/components/admin/AdminActions";
import { NotAllowed } from "@/components/auth/NotAllowed";
import { Bi, N, T } from "@/components/i18n/LangProvider";
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
        subtitleEn="Today's registrations, mutation cases, sealed reports and the audit log — at a glance."
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
    { bn: "দাগ", en: "Dags", n: summary.dags },
    { bn: "নিবন্ধিত লেনদেন", en: "Registered transactions", n: summary.accepted },
    { bn: "আটকানো লেনদেন", en: "Blocked transactions", n: summary.refused },
    { bn: "অপেক্ষমাণ নামজারি", en: "Pending mutations", n: summary.pending_mutations },
    { bn: "সিলযুক্ত রিপোর্ট", en: "Sealed reports", n: summary.seals },
    { bn: "অডিট এন্ট্রি", en: "Audit entries", n: summary.audit_entries },
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="today" className="space-y-2">
        <h2 id="today" className="text-lg font-semibold">
          <T bn="এক নজরে" en="At a glance" />
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="office-tiles">
          {tiles.map((t) => (
            <li key={t.bn} className="rounded-xl border border-line bg-card p-3">
              <p className="text-2xl font-bold">
                <N v={t.n} />
              </p>
              <p className="text-sm text-ink-soft">
                <T bn={t.bn} en={t.en} />
              </p>
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
          <T
            bn={
              chain.ok
                ? `অডিট লগের শৃঙ্খল অক্ষত — ${bn(chain.entries)}টি এন্ট্রি যাচাই হয়েছে`
                : `অডিট লগের শৃঙ্খল ভাঙা: এন্ট্রি ${bn(chain.broken_at ?? 0)} — অবিলম্বে তদন্ত করুন`
            }
            en={
              chain.ok
                ? `Audit log hash chain intact — ${chain.entries} entries checked`
                : `Audit log hash chain broken at entry ${chain.broken_at} — investigate now`
            }
          />
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="mut" className="space-y-2">
          <h2 id="mut" className="text-lg font-semibold">
            <T bn="নামজারি মামলা" en="Mutation cases" />
          </h2>
          {activity.mutations.length === 0 ? (
            <p className="rounded-xl border border-line bg-card p-3 text-ink-soft">
              <T
                bn="এখনও কোনো নামজারি মামলা নেই। সাব-রেজিস্ট্রিতে দলিল নিবন্ধন হলে এখানে দেখাবে।"
                en="No mutation cases yet. They appear here when a deed is registered at the sub-registry."
              />
            </p>
          ) : (
            <ul className="space-y-2">
              {activity.mutations.map((m) => (
                <li key={m.case_no} className="rounded-xl border border-line bg-card p-3 text-sm">
                  <p className="font-medium">
                    {m.case_no}:{" "}
                    <T
                      bn={`${m.mouza_bn}, দাগ ${bn(m.dag_no)} — ${bn(m.area_dec)} শতক`}
                      en={`${m.mouza_en}, dag ${m.dag_no} — ${m.area_dec} dec`}
                    />
                  </p>
                  <p className="text-ink-soft">
                    <T
                      bn={`${m.from_bn} → ${m.to_bn} · শেষ তারিখ ${bn(m.deadline_on)}`}
                      en={`${m.from_en} → ${m.to_en} · due ${m.deadline_on}`}
                    />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="audit" className="space-y-2">
          <h2 id="audit" className="text-lg font-semibold">
            <T bn="সাম্প্রতিক অডিট লগ" en="Recent audit log" />
          </h2>
          {audit.length === 0 ? (
            <p className="rounded-xl border border-line bg-card p-3 text-ink-soft">
              <T
                bn="অডিট লগ এখন খালি (ডেমো রিসেটের পরে)।"
                en="The audit log is empty (after a demo reset)."
              />
            </p>
          ) : (
            <ol className="space-y-1 text-sm" data-testid="office-audit">
              {audit.map((a) => (
                <li key={a.id} className="rounded-lg border border-line bg-card px-3 py-2">
                  <T
                    bn={`${a.role_bn} ${a.action_bn}${a.place_bn ? ` · ${bn(a.place_bn)}` : ""}`}
                    en={`${a.role_en} ${a.action_en}${a.place_en ? ` · ${a.place_en}` : ""}`}
                  />
                  <span className="block text-ink-soft">
                    <N v={a.at} />
                  </span>
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
            <Bi bn="প্রশাসক" en="Admin only" />
          </h2>
          <AccountsTable accounts={accounts} />
          <ResetDemoButton />
        </section>
      ) : null}
    </div>
  );
}
