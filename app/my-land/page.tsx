import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { requirePageRole } from "@/lib/auth/guard";
import type { ChainReport, LandViewEntry } from "@/lib/engines/audit";
import { allowed } from "@/lib/auth/roles";
import { runTool } from "@/lib/tools/registry";

export const metadata: Metadata = { title: "আমার জমি কে দেখেছে" };

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

export default function MyLandPage() {
  return (
    <>
      <PageHeader
        titleBn="আমার জমি কে দেখেছে"
        titleEn="Who checked my land"
        subtitleBn="আপনার দাগ কে কবে যাচাই করেছে, লেজার দেখেছে বা নিবন্ধনের চেষ্টা করেছে — সব অডিট লগে থাকে, কেউ মুছতে পারে না।"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-ink-soft">লোড হচ্ছে… Loading…</p>}>
          <Content />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Content() {
  await connection();
  const { user } = await requirePageRole("citizen", "/my-land");
  const ctx = { user };
  const who = (await runTool("who_checked", { limit: 50 }, ctx)) as {
    linked: boolean;
    entries: LandViewEntry[];
  };
  const chain = allowed(user, "officer")
    ? ((await runTool("audit_status", {}, ctx)) as ChainReport)
    : null;

  return (
    <div className="space-y-5">
      {chain ? (
        <section
          data-testid="chain-status"
          data-ok={chain.ok}
          className={`rounded-xl border p-3 ${chain.ok ? "border-verdict-green/40 bg-green-50" : "border-verdict-red/40 bg-red-50"}`}
        >
          <p className="font-semibold">
            {chain.ok
              ? `অডিট লগের শৃঙ্খল অক্ষত — ${bn(chain.entries)}টি এন্ট্রি যাচাই হয়েছে`
              : `অডিট লগের শৃঙ্খল ভাঙা: এন্ট্রি ${bn(chain.broken_at ?? 0)}`}
          </p>
          <p lang="en" className="text-sm text-ink-soft">
            {chain.ok
              ? `Hash chain intact (${chain.entries} entries).`
              : `Hash chain broken at entry ${chain.broken_at} (${chain.reason}).`}
          </p>
        </section>
      ) : null}

      {!who.linked ? (
        <p className="rounded-xl border border-line bg-card p-4">
          এই অ্যাকাউন্টের সাথে কোনো জমির মালিকানা যুক্ত নেই।
          <span lang="en" className="block text-sm text-ink-soft">
            This account is not linked to a land holder.
          </span>
        </p>
      ) : who.entries.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-4" data-testid="no-views">
          এখনও কেউ আপনার জমি দেখেনি।
        </p>
      ) : (
        <ol className="space-y-2" data-testid="who-checked">
          {who.entries.map((e) => (
            <li
              key={e.id}
              className="rounded-xl border border-line bg-card p-3"
              data-action={e.action}
            >
              <p className="font-medium">
                {e.role_bn} {e.action_bn}
              </p>
              <p className="text-sm text-ink-soft">
                {e.mouza_bn} মৌজা, দাগ {bn(e.dag_no)} · {bn(e.at)}
              </p>
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm text-ink-soft">
        গোপনীয়তার জন্য অন্য মানুষের নাম দেখানো হয় না, শুধু তাদের ভূমিকা।
        <span lang="en" className="block">
          For privacy, only the viewer&apos;s role is shown, never their name.
        </span>
      </p>
    </div>
  );
}
