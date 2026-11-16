import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { T } from "@/components/i18n/LangProvider";
import { DecideButtons, PayPanel, PrintButton } from "@/components/services/Actions";
import { StatusBadge, Stepper } from "@/components/services/Status";
import { requirePageRole } from "@/lib/auth/guard";
import { allowed } from "@/lib/auth/roles";
import { getApplication } from "@/lib/engines/applications";
import { parseDocCode } from "@/lib/engines/documents";
import { METHOD_LABEL, type PaymentMethod } from "@/lib/adapters/payment";
import { APPLICATION_TYPES } from "@/lib/services/catalog";
import { runTool } from "@/lib/tools/registry";

export const metadata: Metadata = { title: "আবেদনের অবস্থা" };

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
const SURVEY_BN = { CS: "সিএস", SA: "এসএ", RS: "আরএস", BS: "বিএস" } as const;

export default function ApplicationPage({ params }: PageProps<"/my/applications/[no]">) {
  return (
    <Suspense fallback={<p className="p-6 text-ink-soft">লোড হচ্ছে… Loading…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ no: string }> }) {
  await connection();
  const { no: raw } = await params;
  const no = decodeURIComponent(raw).toUpperCase();
  const { user } = await requirePageRole("citizen", `/my/applications/${no}`);
  const app = /^[A-Z]{3}-\d{4}-\d{4,6}$/.test(no) ? await getApplication(user, no) : null; // RLS
  if (!app) {
    return (
      <>
        <PageHeader titleBn="আবেদন পাওয়া যায়নি" titleEn="Application not found" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <p
            role="alert"
            className="rounded-xl border border-line bg-card p-4"
            data-testid="app-missing"
          >
            <T bn="এই নম্বরে আপনার কোনো আবেদন নেই।" en="You have no application with this number." />
          </p>
        </main>
      </>
    );
  }
  const def = APPLICATION_TYPES[app.type];
  const isOfficer = allowed(user, "officer");
  const qr =
    app.status === "completed"
      ? ((await runTool("document_qr", { app_no: app.app_no }, { user })) as { code: string; verify_url: string; qr_svg: string; id: string } | null) // prettier-ignore
      : null;
  const doc = qr ? parseDocCode(qr.code)?.payload : null;
  const d = app.details;

  return (
    <>
      <PageHeader
        titleBn={`আবেদন ${app.app_no}`}
        titleEn={`Application ${app.app_no}`}
        subtitleBn={def.bn}
        subtitleEn={def.en}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6">
        <section className="rounded-2xl border border-line bg-card p-4 shadow-sm print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              <T
                bn={`${d.mouza_bn ?? d.mouza} মৌজা, দাগ ${bn(d.dag_no)} · ${SURVEY_BN[d.survey]} খতিয়ান · ${d.delivery === "post" ? "ডাকযোগে" : "অনলাইনে"}`}
                en={`${d.mouza_en ?? d.mouza} mouza, dag ${d.dag_no} · ${d.survey} khatian · ${d.delivery === "post" ? "by post" : "online"}`}
              />
            </p>
            <StatusBadge status={app.status} />
          </div>
          <div className="mt-4">
            <Stepper steps={def.steps} status={app.status} />
          </div>
          {app.due_on && app.status === "in_review" ? (
            <p className="mt-3 text-sm">
              <T
                bn={`অফিসের সিদ্ধান্তের শেষ তারিখ: ${bn(app.due_on)}`}
                en={`Office decision due by: ${app.due_on}`}
              />
            </p>
          ) : null}
          {app.status === "rejected" && app.decision_note ? (
            <p
              className="mt-3 rounded-lg border border-verdict-red/40 bg-red-50 p-3"
              data-testid="reject-reason"
            >
              <T
                bn={`নামঞ্জুরের কারণ: ${app.decision_note}`}
                en={`Reason for rejection: ${app.decision_note}`}
              />
            </p>
          ) : null}
        </section>

        {app.status === "payment_due" && app.applicant_is_me ? (
          <PayPanel appNo={app.app_no} amount={app.fee_taka} />
        ) : null}
        {app.status === "in_review" && isOfficer ? (
          <section className="rounded-2xl border border-line bg-card p-4 print:hidden">
            <h2 className="mb-2 font-semibold">
              <T bn="কর্মকর্তার সিদ্ধান্ত" en="Officer decision" />
            </h2>
            <DecideButtons appNo={app.app_no} />
          </section>
        ) : null}

        {qr && doc ? (
          <section
            className="rounded-2xl border-2 border-verdict-green/50 bg-white p-5 shadow-sm print:border-black print:shadow-none"
            aria-labelledby="doc-h"
            data-testid="issued-document"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <T
                    bn="ভূমিসাথী · স্বাক্ষরিত কপি (প্রোটোটাইপ, কৃত্রিম তথ্য)"
                    en="BhumiSathi · signed copy (prototype, synthetic data)"
                  />
                </p>
                <h2 id="doc-h" className="mt-1 text-xl font-bold">
                  <T
                    bn={`${SURVEY_BN[doc.survey]} খতিয়ান নং ${bn(doc.khatian_no)} (${bn(doc.year)})`}
                    en={`${doc.survey} khatian no. ${doc.khatian_no} (${doc.year})`}
                  />
                </h2>
                <p className="mt-1">
                  <T
                    bn={`${doc.mouza_bn} মৌজা, জে.এল. ${bn(doc.jl_no)} · দাগ ${bn(doc.dag_no)} · ${bn(doc.area_dec)} শতক`}
                    en={`${doc.mouza_en} mouza, JL ${doc.jl_no} · dag ${doc.dag_no} · ${doc.area_dec} decimals`}
                  />
                </p>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="py-1">
                        <T bn="মালিক" en="Holder" />
                      </th>
                      <th className="py-1 text-right">
                        <T bn="অংশ (শতক)" en="Share (dec)" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.owners.map((o) => (
                      <tr key={o.name_bn} className="border-b border-line/60">
                        <td className="py-1">
                          <T bn={o.name_bn} en={o.name_en} />
                        </td>
                        <td className="py-1 text-right">
                          <T bn={bn(o.share_dec)} en={String(o.share_dec)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-ink-soft">
                  <T
                    bn={`আবেদন ${app.app_no} · ডকুমেন্ট আইডি ${doc.id} · স্বাক্ষর ${bn(doc.issued_at.slice(0, 10))}`}
                    en={`Application ${app.app_no} · document id ${doc.id} · signed ${doc.issued_at.slice(0, 10)}`}
                  />
                </p>
              </div>
              <figure className="w-36 shrink-0 text-center">
                <div
                  className="[&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qr.qr_svg }}
                />
                <figcaption className="text-xs text-ink-soft">
                  <T bn="স্ক্যান করে যাচাই করুন" en="Scan to verify" />
                </figcaption>
              </figure>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <PrintButton />
              <Link
                href={`/verify/doc#${qr.code}`}
                className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-deep"
              >
                <T bn="এখনই যাচাই করুন" en="Verify now" />
              </Link>
            </div>
          </section>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 print:hidden">
          <section className="rounded-2xl border border-line bg-card p-4" aria-labelledby="fee-h">
            <h2 id="fee-h" className="font-semibold">
              <T bn="ফি" en="Fee" />
            </h2>
            <dl className="mt-2 divide-y divide-line text-sm">
              {app.fee_lines.map((l) => (
                <div key={l.en} className="flex justify-between py-1.5">
                  <dt>
                    <T bn={l.bn} en={l.en} />
                  </dt>
                  <dd>
                    <T bn={`৳${bn(l.tk)}`} en={`Tk ${l.tk}`} />
                  </dd>
                </div>
              ))}
              <div className="flex justify-between py-1.5 font-bold">
                <dt>
                  <T bn="মোট" en="Total" />
                </dt>
                <dd>
                  <T bn={`৳${bn(app.fee_taka)}`} en={`Tk ${app.fee_taka}`} />
                </dd>
              </div>
            </dl>
            {app.payments.map((p) => (
              <p
                key={p.txn_ref}
                className="mt-2 rounded-lg bg-green-50 p-2 text-sm"
                data-testid="receipt"
              >
                <T
                  bn={`পরিশোধিত (পরীক্ষা): রসিদ ${p.txn_ref} · ${METHOD_LABEL[p.method as PaymentMethod]?.bn ?? p.method}`}
                  en={`Paid (test): receipt ${p.txn_ref} · ${METHOD_LABEL[p.method as PaymentMethod]?.en ?? p.method}`}
                />
              </p>
            ))}
          </section>

          <section className="rounded-2xl border border-line bg-card p-4" aria-labelledby="tl-h">
            <h2 id="tl-h" className="font-semibold">
              <T bn="সময়রেখা" en="Timeline" />
            </h2>
            <ol className="mt-2 space-y-3 border-l-2 border-brand/30 pl-4" data-testid="timeline">
              {app.events.map((e, i) => (
                <li key={i} data-action={e.action} className="relative">
                  <span
                    className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full bg-brand"
                    aria-hidden="true"
                  />
                  <p className="text-sm">
                    <T bn={e.note_bn} en={e.note_en} />
                  </p>
                  <p className="text-xs text-ink-soft">
                    <T
                      bn={bn(new Date(e.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }))}
                      en={new Date(e.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}
                    />
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <p className="print:hidden">
          <Link href="/my" className="inline-flex min-h-11 items-center underline">
            <T bn="← আমার সেবা" en="← My services" />
          </Link>
        </p>
      </main>
    </>
  );
}
