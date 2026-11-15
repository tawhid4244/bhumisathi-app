import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Verifier } from "@/components/seal/Verifier";
import { T } from "@/components/i18n/LangProvider";

export const metadata: Metadata = { title: "রিপোর্ট যাচাই" };

// /verify#BS1.… — opened by scanning a BhumiSeal QR code. No account needed.
export default function VerifyPage() {
  return (
    <>
      <PageHeader
        titleBn="সিলযুক্ত রিপোর্ট যাচাই"
        titleEn="Verify a BhumiSeal report"
        subtitleBn="QR কোড স্ক্যান করুন বা কোডটি লিখুন — চারটি বাতি বলে দেবে রিপোর্টটি বিশ্বাসযোগ্য কি না।"
        subtitleEn="Scan the QR code or type the code — four lights tell you whether the report can be trusted."
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Verifier />
        <p className="mt-8 text-sm text-ink-soft">
          <T
            bn="যাচাই হয় ভূমিসাথীর পাবলিক চাবি (Ed25519) দিয়ে — যে কেউ অফলাইনেও যাচাই করতে পারেন।"
            en="Checked with BhumiSathi's public Ed25519 key; anyone can verify offline."
          />{" "}
          <a href="/api/seal/key" className="underline">
            <T bn="পাবলিক চাবি দেখুন" en="See the public key" />
          </a>
        </p>
      </main>
    </>
  );
}
