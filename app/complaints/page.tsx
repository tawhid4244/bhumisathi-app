import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { T } from "@/components/i18n/LangProvider";
import type { ComplaintStats } from "@/lib/engines/complaints";
import { runTool } from "@/lib/tools/registry";

export const metadata: Metadata = { title: "অভিযোগ" };

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

// Public page: how to complain, and this month's statistics (counts only — no names, no texts).
export default function ComplaintsPage() {
  return (
    <>
      <PageHeader
        titleBn="অভিযোগ ও সহায়তা"
        titleEn="Complaints and help"
        subtitleBn="দালাল, সরকারি ফির বেশি টাকা, দেরি বা ভুল রেকর্ড — জানান। নাম গোপন রাখা যায়।"
        subtitleEn="A broker, more than the official fee, a delay or a wrong record — report it. You can stay anonymous."
      />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/services/apply/complaint"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-deep"
          >
            <T bn="অভিযোগ করুন" en="Make a complaint" />
          </Link>
          <Link
            href="/chat"
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-card px-4 font-semibold hover:border-brand"
          >
            <T bn="সাথী এআই-কে মুখে বলুন" en="Tell Sathi AI by voice" />
          </Link>
          <Link
            href="/fees"
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-card px-4 font-semibold hover:border-brand"
          >
            <T bn="সরকারি ফি দেখুন" en="See the official fees" />
          </Link>
        </div>
        <Suspense fallback={<p className="text-ink-soft">লোড হচ্ছে… Loading…</p>}>
          <Stats />
        </Suspense>
      </main>
    </>
  );
}

async function Stats() {
  await connection();
  const s = (await runTool("complaint_stats", {}, { user: null })) as ComplaintStats;
  const max = Math.max(1, ...s.by_category.map((c) => c.n));
  return (
    <section
      aria-labelledby="stats-h"
      className="rounded-2xl border border-line bg-card p-4"
      data-testid="complaint-stats"
    >
      <h2 id="stats-h" className="text-lg font-bold">
        <T bn={`এই মাসের পরিসংখ্যান (${bn(s.month)})`} en={`This month (${s.month})`} />
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {[
          { bn: "মোট অভিযোগ", en: "Complaints", v: String(s.total) },
          { bn: "নিষ্পত্তি", en: "Resolved", v: String(s.resolved) },
          { bn: "চলমান", en: "Open", v: String(s.open) },
          {
            bn: "সময়মতো নিষ্পত্তি",
            en: "Resolved on time",
            v: s.on_time_pct == null ? "—" : `${s.on_time_pct}%`,
          },
        ].map((x) => (
          <div key={x.en} className="rounded-xl border border-line bg-white p-3">
            <dt className="text-sm text-ink-soft">
              <T bn={x.bn} en={x.en} />
            </dt>
            <dd className="text-2xl font-bold">
              <T bn={bn(x.v)} en={x.v} />
            </dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 space-y-2" aria-label="ধরন অনুযায়ী / By type">
        {s.by_category.map((c) => (
          <li
            key={c.category}
            className="grid grid-cols-[minmax(0,12rem)_1fr_2.5rem] items-center gap-2 text-sm"
          >
            <span>
              <T bn={c.bn} en={c.en} />
            </span>
            <span className="h-3 rounded-full bg-gray-100" aria-hidden="true">
              <span
                className="block h-3 rounded-full bg-brand"
                style={{ width: `${(100 * c.n) / max}%` }}
              />
            </span>
            <span className="text-right font-semibold">
              <T bn={bn(c.n)} en={String(c.n)} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">
        <T
          bn="শুধু সংখ্যা দেখানো হয় — কারও নাম বা অভিযোগের লেখা নয়। সব তথ্য কৃত্রিম।"
          en="Counts only — never names or complaint texts. All data is synthetic."
        />
      </p>
    </section>
  );
}
