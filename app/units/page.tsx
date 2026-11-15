import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { UnitConverter } from "@/components/units/UnitConverter";

export const metadata: Metadata = { title: "জমির একক রূপান্তর" };

export default function UnitsPage() {
  return (
    <>
      <PageHeader
        titleBn="জমির একক রূপান্তর"
        titleEn="Land unit converter (kani, gonda, bigha, katha → decimals, acres, sq ft)"
        subtitleBn="পুরনো দলিলের কানি-গন্ডা বা বিঘা-কাঠা শতক, একর ও বর্গফুটে — এলাকাভেদে মাপের পার্থক্যসহ।"
        subtitleEn="Old deeds in kani-gonda or bigha-katha → decimals, acres and square feet, with the regional differences."
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <UnitConverter />
      </main>
    </>
  );
}
