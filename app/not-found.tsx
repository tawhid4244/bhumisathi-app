import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export default function NotFound() {
  return (
    <>
      <PageHeader titleBn="পাতাটি পাওয়া যায়নি" titleEn="Page not found" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <p>এই ঠিকানায় কোনো পাতা নেই। ঠিকানাটি আবার দেখুন, বা হোম থেকে শুরু করুন।</p>
        <p lang="en" className="text-sm text-ink-soft">
          There is no page at this address.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-semibold text-white"
        >
          হোমে যান
        </Link>
      </main>
    </>
  );
}
