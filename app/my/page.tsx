import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { T } from "@/components/i18n/LangProvider";
import { MarkReadButton } from "@/components/services/Actions";
import { StatusBadge, Stepper } from "@/components/services/Status";
import { requirePageRole } from "@/lib/auth/guard";
import type { AppSummary, Notification } from "@/lib/engines/applications";
import { APPLICATION_TYPES } from "@/lib/services/catalog";
import { runTool } from "@/lib/tools/registry";

export const metadata: Metadata = { title: "আমার সেবা" };

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

// My services: my applications with progress, the notification bell's messages, shortcuts.
export default function MyServicesPage() {
  return (
    <>
      <PageHeader
        titleBn="আমার সেবা"
        titleEn="My services"
        subtitleBn="আপনার আবেদন, ফি, সিদ্ধান্ত আর স্বাক্ষরিত কপি — এক জায়গায়।"
        subtitleEn="Your applications, fees, decisions and signed copies — in one place."
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
  const { user } = await requirePageRole("citizen", "/my");
  const ctx = { user };
  const [status, notes] = (await Promise.all([
    runTool("application_status", {}, ctx),
    runTool("notifications", {}, ctx),
  ])) as [{ applications: AppSummary[] }, { unread: number; items: Notification[] }];
  const apps = status.applications;
  const open = apps.filter((a) => a.status === "payment_due" || a.status === "in_review").length;
  const done = apps.filter((a) => a.status === "completed").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="apps-h" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="apps-h" className="text-xl font-bold">
            <T bn="আমার আবেদন" en="My applications" />
          </h2>
          <Link
            href="/services"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-deep"
          >
            <T bn="+ নতুন আবেদন" en="+ New application" />
          </Link>
        </div>
        <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
          {[
            { bn: "মোট", en: "Total", v: apps.length },
            { bn: "চলমান", en: "In progress", v: open },
            { bn: "সম্পন্ন", en: "Done", v: done },
          ].map((s) => (
            <div key={s.en} className="rounded-xl border border-line bg-card p-3">
              <dt className="text-sm text-ink-soft">
                <T bn={s.bn} en={s.en} />
              </dt>
              <dd className="text-2xl font-bold">
                <T bn={bn(s.v)} en={String(s.v)} />
              </dd>
            </div>
          ))}
        </dl>
        {apps.length === 0 ? (
          <p className="rounded-xl border border-line bg-card p-4" data-testid="no-apps">
            <T
              bn="এখনও কোনো আবেদন নেই। ‘নতুন আবেদন’ চাপুন।"
              en="No applications yet. Press ‘New application’."
            />
          </p>
        ) : (
          <ul className="space-y-3" data-testid="my-apps">
            {apps.map((a) => {
              const def = APPLICATION_TYPES[a.type];
              return (
                <li key={a.app_no}>
                  <Link
                    href={`/my/applications/${a.app_no}`}
                    className="block rounded-2xl border border-line bg-card p-4 shadow-sm transition-shadow hover:border-brand hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        <span lang="en">{a.app_no}</span> ·{" "}
                        <T bn={def?.bn ?? a.type} en={def?.en ?? a.type} />
                      </p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      <T
                        bn={`${a.mouza_bn} মৌজা, দাগ ${bn(a.dag_no)}${a.due_on && a.status === "in_review" ? ` · সিদ্ধান্তের শেষ তারিখ ${bn(a.due_on)}` : ""}`}
                        en={`${a.mouza_en} mouza, dag ${a.dag_no}${a.due_on && a.status === "in_review" ? ` · decision due ${a.due_on}` : ""}`}
                      />
                    </p>
                    {def ? (
                      <div className="mt-3">
                        <Stepper steps={def.steps} status={a.status} />
                      </div>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="space-y-4">
        <section
          aria-labelledby="bell-h"
          className="rounded-2xl border border-line bg-card p-4"
          id="notifications"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="bell-h" className="font-bold">
              <span aria-hidden="true">🔔 </span>
              <T bn="নোটিফিকেশন" en="Notifications" />
              {notes.unread > 0 ? (
                <span
                  className="ml-2 rounded-full bg-verdict-red px-2 py-0.5 text-xs text-white"
                  data-testid="unread"
                >
                  <T bn={bn(notes.unread)} en={String(notes.unread)} />
                </span>
              ) : null}
            </h2>
            {notes.unread > 0 ? <MarkReadButton /> : null}
          </div>
          {notes.items.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              <T bn="কোনো নোটিফিকেশন নেই।" en="No notifications." />
            </p>
          ) : (
            <ul className="mt-2 space-y-2" data-testid="notifications">
              {notes.items.slice(0, 8).map((n) => (
                <li
                  key={n.id}
                  className={`rounded-lg border p-2 text-sm ${n.read ? "border-line" : "border-brand/40 bg-brand-soft"}`}
                >
                  <Link href={n.link ?? "/my"} className="block">
                    <span className="block font-semibold">
                      <T bn={n.title_bn} en={n.title_en} />
                    </span>
                    <span className="block text-ink-soft">
                      <T bn={n.body_bn} en={n.body_en} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <nav aria-label="শর্টকাট / Shortcuts" className="rounded-2xl border border-line bg-card p-4">
          <h2 className="mb-2 font-bold">
            <T bn="দ্রুত যান" en="Shortcuts" />
          </h2>
          <ul className="space-y-1">
            {[
              { href: "/check", bn: "জমি যাচাই", en: "Check land" },
              { href: "/track", bn: "নম্বর দিয়ে অবস্থা", en: "Track by number" },
              { href: "/verify/doc", bn: "কপি যাচাই", en: "Verify a copy" },
              ...(user.owner_id
                ? [{ href: "/my-land", bn: "আমার জমি কে দেখেছে", en: "Who checked my land" }]
                : []),
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex min-h-11 items-center rounded-lg px-2 hover:bg-brand-soft"
                >
                  <T bn={l.bn} en={l.en} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
