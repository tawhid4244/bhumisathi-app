import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { T } from "@/components/i18n/LangProvider";
import { DecideButtons, PayPanel, PrintButton } from "@/components/services/Actions";
import { StatusBadge, Stepper } from "@/components/services/Status";
import { METHOD_LABEL, type PaymentMethod } from "@/lib/adapters/payment";
import { requirePageRole } from "@/lib/auth/guard";
import { allowed } from "@/lib/auth/roles";
import { getApplication } from "@/lib/engines/applications";
import { parseDocCode } from "@/lib/engines/documents";
import { APPLICATION_TYPES } from "@/lib/services/catalog";
import { describeDoc } from "@/lib/services/doc-view";
import { runTool } from "@/lib/tools/registry";

export const metadata: Metadata = { title: "আবেদনের অবস্থা" };

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
const when = (at: string) => new Date(at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });

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
    app.status === "completed" && app.documents.length
      ? ((await runTool("document_qr", { app_no: app.app_no }, { user })) as { code: string; verify_url: string; qr_svg: string; id: string } | null) // prettier-ignore
      : null;
  const doc = qr ? parseDocCode(qr.code)?.payload : null;
  const view = doc ? describeDoc(doc) : null;
  const d = app.details;
  const payable = (app.status === "payment_due" || app.status === "final_payment_due") && app.applicant_is_me; // prettier-ignore

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
            <p className="font-semibold" data-testid="app-summary">
              <T bn={app.summary_bn} en={app.summary_en} />
            </p>
            <StatusBadge status={app.status} type={app.type} />
          </div>
          <div className="mt-4">
            <Stepper type={app.type} status={app.status} />
          </div>
          {app.hearing ? (
            <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm" data-testid="hearing">
              <T
                bn={`শুনানি: ${bn(app.hearing.on)}, ${app.hearing.place_bn}। দলিল ও পরিচয়পত্র সঙ্গে আনুন।`}
                en={`Hearing: ${app.hearing.on}, ${app.hearing.place_en}. Bring the deed and your ID.`}
              />
            </p>
          ) : null}
          {app.due_on && (app.status === "in_review" || app.status === "hearing") ? (
            <p className="mt-3 text-sm">
              <T
                bn={`অফিসের সিদ্ধান্তের শেষ তারিখ: ${bn(app.due_on)}`}
                en={`Office decision due by: ${app.due_on}`}
              />
            </p>
          ) : null}
          {app.type === "complaint" && d.text ? (
            <blockquote
              className="mt-3 rounded-lg border-l-4 border-brand bg-white p-3 text-sm"
              data-testid="complaint-text"
            >
              “{d.text}”
              {d.anonymous ? (
                <span className="mt-1 block text-xs text-ink-soft">
                  <T
                    bn="বেনামি: অফিস আপনার নাম দেখবে না।"
                    en="Anonymous: the office does not see your name."
                  />
                </span>
              ) : null}
            </blockquote>
          ) : null}
          {app.decision_note && (app.status === "rejected" || app.status === "completed") ? (
            <p
              className={`mt-3 rounded-lg border p-3 ${app.status === "rejected" ? "border-verdict-red/40 bg-red-50" : "border-verdict-green/40 bg-green-50"}`}
              data-testid="decision-note"
            >
              <T
                bn={`${app.status === "rejected" ? "কারণ" : "অফিস যা করেছে"}: ${app.decision_note}`}
                en={`${app.status === "rejected" ? "Reason" : "What the office did"}: ${app.decision_note}`}
              />
            </p>
          ) : null}
        </section>

        {payable ? (
          <PayPanel
            appNo={app.app_no}
            amount={app.amount_due}
            final={app.status === "final_payment_due"}
          />
        ) : null}
        {(app.status === "in_review" || app.status === "hearing") && isOfficer ? (
          <section className="rounded-2xl border border-line bg-card p-4 print:hidden">
            <h2 className="mb-2 font-semibold">
              <T bn="কর্মকর্তার সিদ্ধান্ত" en="Officer decision" />
            </h2>
            <DecideButtons
              appNo={app.app_no}
              type={app.type}
              canHear={!!def.hearing && app.status === "in_review"}
            />
          </section>
        ) : null}

        {qr && view ? (
          <section
            className="rounded-2xl border-2 border-verdict-green/50 bg-white p-5 shadow-sm print:border-black print:shadow-none"
            aria-labelledby="doc-h"
            data-testid="issued-document"
            data-kind={doc?.kind}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <T bn={view.heading_bn} en={view.heading_en} />
                </p>
                <h2 id="doc-h" className="mt-1 text-xl font-bold">
                  <T bn={view.title_bn} en={view.title_en} />
                </h2>
                {view.lines.map((l) => (
                  <p key={l.en} className="mt-1 text-sm">
                    <T bn={l.bn} en={l.en} />
                  </p>
                ))}
                {view.table.length ? (
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="py-1">
                          <T bn={view.table_head.name_bn} en={view.table_head.name_en} />
                        </th>
                        <th className="py-1 text-right">
                          <T bn={view.table_head.value_bn} en={view.table_head.value_en} />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.table.map((o) => (
                        <tr key={o.name_en} className="border-b border-line/60">
                          <td className="py-1">
                            <T bn={o.name_bn} en={o.name_en} />
                          </td>
                          <td className="py-1 text-right">
                            <T bn={o.value_bn} en={o.value_en} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
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
              {app.type === "mutation" && d.mouza_en ? (
                <Link
                  href={`/check?mouza=${encodeURIComponent(d.mouza_en.toLowerCase())}&by=dag&no=${d.dag_no}`}
                  className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold"
                >
                  <T bn="দাগের নতুন রিপোর্ট দেখুন" en="See the dag's new report" />
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 print:hidden">
          {app.fee_lines.length || app.payments.length ? (
            <section className="rounded-2xl border border-line bg-card p-4" aria-labelledby="fee-h">
              <h2 id="fee-h" className="font-semibold">
                <T bn="ফি" en="Fee" />
              </h2>
              <dl className="mt-2 divide-y divide-line text-sm">
                {app.fee_lines.map((l) => (
                  <div key={l.en} className="flex justify-between gap-2 py-1.5">
                    <dt>
                      <T bn={l.bn} en={l.en} />
                      {l.stage === "approval" ? (
                        <span className="ml-1 text-xs text-ink-soft">
                          <T bn="(অনুমোদনের পর)" en="(after approval)" />
                        </span>
                      ) : null}
                    </dt>
                    <dd className="shrink-0">
                      <T bn={`৳${bn(l.tk)}`} en={`Tk ${l.tk}`} />
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 font-bold">
                  <dt>
                    <T bn="মোট" en="Total" />
                  </dt>
                  <dd>
                    <T
                      bn={`৳${bn(app.fee_lines.reduce((t, l) => t + l.tk, 0))}`}
                      en={`Tk ${app.fee_lines.reduce((t, l) => t + l.tk, 0)}`}
                    />
                  </dd>
                </div>
              </dl>
              {app.type === "land_tax" && d.basis_bn ? (
                <p className="mt-2 text-xs text-ink-soft">
                  <T bn={d.basis_bn} en={d.basis_en ?? d.basis_bn} />
                </p>
              ) : null}
              {app.payments.map((p) => (
                <p
                  key={p.txn_ref}
                  className="mt-2 rounded-lg bg-green-50 p-2 text-sm"
                  data-testid="receipt"
                >
                  <T
                    bn={`পরিশোধিত (পরীক্ষা) ৳${bn(p.amount_taka)}: রসিদ ${p.txn_ref} · ${METHOD_LABEL[p.method as PaymentMethod]?.bn ?? p.method}`}
                    en={`Paid (test) Tk ${p.amount_taka}: receipt ${p.txn_ref} · ${METHOD_LABEL[p.method as PaymentMethod]?.en ?? p.method}`}
                  />
                </p>
              ))}
            </section>
          ) : null}

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
                    <T bn={bn(when(e.at))} en={when(e.at)} />
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <p className="print:hidden">
          <Link
            href={isOfficer && !app.applicant_is_me ? "/inbox" : "/my"}
            className="inline-flex min-h-11 items-center underline"
          >
            {isOfficer && !app.applicant_is_me ? (
              <T bn="← ইনবক্স" en="← Inbox" />
            ) : (
              <T bn="← আমার সেবা" en="← My services" />
            )}
          </Link>
        </p>
      </main>
    </>
  );
}
