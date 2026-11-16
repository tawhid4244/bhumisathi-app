import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { T } from "@/components/i18n/LangProvider";
import { APPLICATION_TYPES, SERVICE_AREAS } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "ভূমি সেবাসমূহ" };

const bn = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

// The 11 land services (as on land.gov.bd), what is open here today and what comes next.
export default function ServicesPage() {
  return (
    <>
      <PageHeader
        titleBn="ভূমি সেবাসমূহ"
        titleEn="Land services"
        subtitleBn="একই জায়গা থেকে আবেদন, ফি পরিশোধ, অবস্থা দেখা আর স্বাক্ষরিত কপি — দালাল ছাড়া।"
        subtitleEn="Apply, pay, track and get a signed copy in one place — without a broker."
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/my"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-deep"
          >
            <T bn="আমার সেবা" en="My services" />
          </Link>
          <Link
            href="/track"
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-card px-4 font-semibold hover:border-brand"
          >
            <T bn="আবেদনের অবস্থা দেখুন" en="Track an application" />
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="service-areas">
          {SERVICE_AREAS.map((a, i) => {
            const open = a.types.map((t) => APPLICATION_TYPES[t]);
            return (
              <li
                key={a.id}
                data-area={a.id}
                className="flex flex-col rounded-2xl border border-line bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-xs font-semibold text-ink-soft">
                  <T bn={`সেবা ${bn(i + 1)}`} en={`Service ${i + 1}`} />
                </p>
                <h2 className="mt-1 text-lg font-bold leading-snug">
                  <T bn={a.bn} en={a.en} />
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  <T bn={a.hint_bn} en={a.hint_en} />
                </p>
                <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
                  {open.map((t) => (
                    <Link
                      key={t.id}
                      href={`/services/apply/${t.id}`}
                      className="inline-flex min-h-11 items-center justify-between rounded-lg bg-brand px-3 font-semibold text-white hover:bg-brand-deep"
                    >
                      <T bn={`আবেদন: ${t.bn}`} en={`Apply: ${t.en}`} />
                      <span aria-hidden="true">→</span>
                    </Link>
                  ))}
                  {a.links.map((l) => (
                    <Link
                      key={l.href + l.en}
                      href={l.href}
                      className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-3 text-sm font-medium hover:border-brand"
                    >
                      <T bn={l.bn} en={l.en} />
                    </Link>
                  ))}
                  {a.phase && a.phase !== "B" ? (
                    <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                      <T
                        bn={open.length ? "আরও সেবা শীঘ্রই আসছে" : "শীঘ্রই আসছে"}
                        en={open.length ? "More coming soon" : "Coming soon"}
                      />
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-sm text-ink-soft">
          <T
            bn="এটি একটি প্রোটোটাইপ, সরকারি ওয়েবসাইট নয়; সব তথ্য কৃত্রিম, পেমেন্ট পরীক্ষামূলক।"
            en="This is a prototype, not a government website; all data is synthetic and payments are sandbox only."
          />
        </p>
      </main>
    </>
  );
}
