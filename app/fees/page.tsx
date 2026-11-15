import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
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
      </main>
    </>
  );
}
