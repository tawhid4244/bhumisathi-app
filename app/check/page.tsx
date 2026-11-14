import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ReportView } from "@/components/check/ReportView";
import { SearchForm } from "@/components/check/SearchForm";
import { KhatianNotFoundError, type JomiReport } from "@/lib/engines/jomi-check";
import { currentUser } from "@/lib/auth/current";
import { runTool } from "@/lib/tools/registry";
import { DagNotFoundError, westernDigits } from "@/lib/engines/ledger";
import { listMouzas } from "@/lib/engines/mouzas";

export const metadata: Metadata = { title: "জমি যাচাই" };

export default function CheckPage(props: PageProps<"/check">) {
  return (
    <>
      <PageHeader
        titleBn="জমি যাচাই"
        titleEn="Jomi Check: check land before you buy"
        subtitleBn="টাকা দেওয়ার আগে দেখে নিন: মালিক কে, কতটুকু বিক্রি করা যায়, কোনো মামলা, বন্ধক বা বায়না আছে কি না।"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <Suspense fallback={<p className="text-ink-soft">লোড হচ্ছে… Loading…</p>}>
          <CheckContent searchParams={props.searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function CheckContent({ searchParams }: Pick<PageProps<"/check">, "searchParams">) {
  const params = await searchParams;
  const mouza = first(params.mouza)?.slice(0, 40);
  const by = first(params.by) === "khatian" ? "khatian" : "dag";
  const rawNo = first(params.no)?.slice(0, 8);
  const no = rawNo ? Number(westernDigits(rawNo.trim())) : NaN;
  const mouzas = await listMouzas();

  let report: JomiReport | null = null;
  let problem: { bn: string; en: string } | null = null;
  if (mouza && rawNo) {
    if (!Number.isInteger(no) || no <= 0) {
      problem = { bn: "সঠিক নম্বর লিখুন (যেমন ১৪৫)।", en: "Enter a valid number, e.g. 145." };
    } else {
      try {
        // Through the tool, as the signed-in user (or a visitor): the view goes into the audit log.
        report = (await runTool(
          "jomi_check",
          by === "khatian" ? { mouza, khatian_no: no } : { mouza, dag_no: no },
          { user: await currentUser() },
        )) as JomiReport;
      } catch (err) {
        if (err instanceof DagNotFoundError || err instanceof KhatianNotFoundError) {
          problem = {
            bn: `এই মৌজায় ${by === "khatian" ? "খতিয়ান" : "দাগ"} নম্বরটি পাওয়া যায়নি। নম্বরটি আবার দেখুন।`,
            en: "That number was not found in this mouza.",
          };
        } else {
          throw err;
        }
      }
    }
  }

  return (
    <>
      <SearchForm mouzas={mouzas} mouza={mouza} by={by} no={rawNo} />
      {problem ? (
        <p role="alert" className="rounded-xl border border-verdict-amber/40 bg-amber-50 p-3">
          {problem.bn}
          <span lang="en" className="block text-sm text-ink-soft">
            {problem.en}
          </span>
        </p>
      ) : null}
      {report ? <ReportView report={report} /> : null}
      {!report && !problem ? (
        <section className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-soft">
          <p>উদাহরণ (কাল্পনিক তথ্য): নয়াপাড়া দাগ ১৪৫, ১৪২, ১৪৬, ১৪৯ অথবা চরপাড়া দাগ ২১০।</p>
          <p lang="en">
            Try (synthetic data): Nayapara dag 145, 142, 146, 149 or Charpara dag 210.
          </p>
        </section>
      ) : null}
    </>
  );
}
