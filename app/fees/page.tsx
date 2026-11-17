import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { T } from "@/components/i18n/LangProvider";
import { FeeList } from "@/components/fees/FeeList";
import { FEE_NOTE, listFees } from "@/lib/engines/fees";

export const metadata: Metadata = { title: "সরকারি ফি ও সময়" };

export default function FeesPage() {
  return (
    <>
      <PageHeader
        titleBn="সরকারি ফি ও সময়"
        titleEn="Official fees and service times"
        subtitleBn="দালালের দরকার নেই: কোন সেবায় কত সরকারি ফি — প্রতিটি লাইনের সূত্রসহ।"
        subtitleEn="No broker needed: the official fee for each service — every line with its source."
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <FeeList services={listFees()} note={FEE_NOTE} />
        <p
          className="rounded-xl border-2 border-verdict-red/40 bg-red-50 p-4"
          data-testid="report-extra"
        >
          <T
            bn="কেউ সরকারি ফির বেশি টাকা চাইলে? "
            en="Someone asked for more than the official fee? "
          />
          <Link href="/services/apply/complaint" className="font-semibold underline">
            <T bn="অভিযোগ করুন (নাম গোপন রাখা যায়)" en="Report it (you can stay anonymous)" />
          </Link>
        </p>
      </main>
    </>
  );
}
