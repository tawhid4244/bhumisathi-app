import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Verifier } from "@/components/seal/Verifier";

export const metadata: Metadata = { title: "রিপোর্ট যাচাই" };

// /verify#BS1.… — opened by scanning a BhumiSeal QR code. No account needed.
export default function VerifyPage() {
  return (
    <>
      <PageHeader
        titleBn="সিলযুক্ত রিপোর্ট যাচাই"
        titleEn="Verify a BhumiSeal report"
        subtitleBn="QR কোড স্ক্যান করুন বা কোডটি লিখুন — চারটি বাতি বলে দেবে রিপোর্টটি বিশ্বাসযোগ্য কি না।"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Verifier />
        <p className="mt-8 text-sm text-ink-soft">
          যাচাই হয় ভূমিসাথীর পাবলিক চাবি দিয়ে (Ed25519)।{" "}
          <a href="/api/seal/key" className="underline">
            পাবলিক চাবি দেখুন
          </a>
          <span lang="en" className="block">
            Checked with BhumiSathi&apos;s public Ed25519 key; anyone can verify offline.
          </span>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
