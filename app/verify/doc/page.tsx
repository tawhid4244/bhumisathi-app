import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { T } from "@/components/i18n/LangProvider";
import { DocVerifier } from "@/components/services/DocVerifier";

export const metadata: Metadata = { title: "কপি যাচাই" };

// /verify/doc#BD1.… — opened by scanning the QR on a signed copy. No account needed.
export default function VerifyDocPage() {
  return (
    <>
      <PageHeader
        titleBn="স্বাক্ষরিত কপি যাচাই"
        titleEn="Verify a signed copy"
        subtitleBn="QR স্ক্যান করুন বা কোডটি লিখুন — চারটি বাতি বলে দেবে কপিটি আসল ও হালনাগাদ কি না।"
        subtitleEn="Scan the QR or type the code — four lights tell you whether the copy is genuine and current."
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <DocVerifier />
        <p className="mt-8 text-sm text-ink-soft">
          <T
            bn="ভূমিসাথীর পাবলিক চাবি (Ed25519) দিয়ে যাচাই হয় — জমি যাচাই রিপোর্টের সিলের একই চাবি।"
            en="Checked with BhumiSathi's public Ed25519 key — the same key as the land report seal."
          />{" "}
          <a href="/api/seal/key" className="underline">
            <T bn="পাবলিক চাবি দেখুন" en="See the public key" />
          </a>
        </p>
      </main>
    </>
  );
}
