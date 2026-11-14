import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JudgeTour } from "@/components/judge/JudgeTour";

export const metadata: Metadata = { title: "জাজ মোড" };

export default function JudgePage() {
  return (
    <>
      <PageHeader
        titleBn="জাজ মোড — ৩ মিনিটে ভূমিসাথী"
        titleEn="Judge mode: BhumiSathi in about 3 minutes"
        subtitleBn="ডেমো রিসেট হয়ে পাঁচটি গল্প পরপর চলবে: দুইবার বিক্রি আটকানো, দলিল পড়া, সাথী এআই, ওয়ারিশ, সিলযুক্ত রিপোর্ট।"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <JudgeTour />
      </main>
      <SiteFooter />
    </>
  );
}
