import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Bi, T } from "@/components/i18n/LangProvider";

export default function NotFound() {
  return (
    <>
      <PageHeader titleBn="পাতাটি পাওয়া যায়নি" titleEn="Page not found" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <p>
          <Bi
            bn="এই ঠিকানায় কোনো পাতা নেই। ঠিকানাটি আবার দেখুন, বা হোম থেকে শুরু করুন।"
            en="There is no page at this address. Check the address, or start from the home page."
            sub="text-sm text-ink-soft"
            block
          />
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-semibold text-white"
        >
          <T bn="হোমে যান" en="Go home" />
        </Link>
      </main>
    </>
  );
}
