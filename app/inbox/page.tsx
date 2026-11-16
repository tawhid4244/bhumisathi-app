import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { NotAllowed } from "@/components/auth/NotAllowed";
import { T } from "@/components/i18n/LangProvider";
import { DecideButtons } from "@/components/services/Actions";
import { requirePageRole } from "@/lib/auth/guard";
import type { InboxItem } from "@/lib/engines/applications";
import { APPLICATION_TYPES } from "@/lib/services/catalog";
import { runTool } from "@/lib/tools/registry";

export const metadata: Metadata = { title: "কর্মকর্তার ইনবক্স" };

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

const SLA = {
  green: { cls: "bg-green-50 text-green-900 border-green-300", bn: "সময় আছে", en: "On time" },
  amber: {
    cls: "bg-amber-100 text-amber-900 border-amber-300",
    bn: "সময় শেষ হয়ে আসছে",
    en: "Due soon",
  },
  red: { cls: "bg-red-50 text-red-900 border-red-300", bn: "সময় পেরিয়েছে", en: "Overdue" },
} as const;

// Officer inbox: paid applications waiting for a decision, most urgent first.
export default function InboxPage() {
  return (
    <>
      <PageHeader
        titleBn="কর্মকর্তার ইনবক্স"
        titleEn="Officer inbox"
        subtitleBn="ফি পরিশোধিত আবেদন — সময়সীমা অনুযায়ী সাজানো। মঞ্জুর করলে স্বাক্ষরিত কপি সাথে সাথে ইস্যু হয়।"
        subtitleEn="Paid applications, ordered by deadline. Approving issues the signed copy at once."
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
  const { user, ok } = await requirePageRole("officer", "/inbox");
  if (!ok) return <NotAllowed need="officer" />;
  const items = (await runTool("application_inbox", {}, { user })) as InboxItem[];
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-card p-4" data-testid="inbox-empty">
        <T bn="এখন কোনো আবেদন অপেক্ষায় নেই।" en="No applications are waiting right now." />
      </p>
    );
  }
  return (
    <ul className="space-y-3" data-testid="inbox">
      {items.map((a) => {
        const def = APPLICATION_TYPES[a.type as keyof typeof APPLICATION_TYPES];
        const sla = SLA[a.sla];
        return (
          <li
            key={a.app_no}
            data-app={a.app_no}
            className="rounded-2xl border border-line bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                <Link
                  href={`/my/applications/${a.app_no}`}
                  className="underline-offset-4 hover:underline"
                  lang="en"
                >
                  {a.app_no}
                </Link>{" "}
                · <T bn={def?.bn ?? a.type} en={def?.en ?? a.type} />
              </p>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-sm font-semibold ${sla.cls}`}
                data-sla={a.sla}
              >
                <T
                  bn={`${sla.bn}${a.days_left != null ? ` · ${bn(Math.abs(a.days_left))} দিন${a.days_left < 0 ? " আগে" : " বাকি"}` : ""}`}
                  en={`${sla.en}${a.days_left != null ? ` · ${Math.abs(a.days_left)} day(s) ${a.days_left < 0 ? "late" : "left"}` : ""}`}
                />
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              <T
                bn={`আবেদনকারী: ${a.applicant_bn} · ${a.mouza_bn} মৌজা, দাগ ${bn(a.dag_no)}, ${a.survey} খতিয়ান · ফি ৳${bn(a.fee_taka)} (রসিদ ${a.paid_ref ?? "—"})`}
                en={`Applicant: ${a.applicant_bn} · ${a.mouza_en} mouza, dag ${a.dag_no}, ${a.survey} khatian · fee Tk ${a.fee_taka} (receipt ${a.paid_ref ?? "—"})`}
              />
            </p>
            <div className="mt-3">
              <DecideButtons appNo={a.app_no} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
