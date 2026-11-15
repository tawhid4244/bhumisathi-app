"use client";

import Link from "next/link";
import { Bi, T } from "@/components/i18n/LangProvider";

// Shown when a page fails unexpectedly. Never shows the technical error to the citizen;
// the digest helps the team find the server log entry.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold">
        <Bi
          bn="দুঃখিত, একটি সমস্যা হয়েছে"
          en="Sorry, something went wrong"
          sub="text-base font-normal text-ink-soft"
          block
        />
      </h1>
      <p className="mt-3">
        <T
          bn="আবার চেষ্টা করুন। সমস্যা থাকলে কিছুক্ষণ পরে আসুন।"
          en="Please try again. If it keeps happening, come back a little later."
        />
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-ink-soft">
          <T bn="কোড:" en="Code:" /> {error.digest}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-lg bg-brand px-4 font-semibold text-white"
        >
          <T bn="আবার চেষ্টা করুন" en="Try again" />
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4"
        >
          <T bn="হোমে যান" en="Go home" />
        </Link>
      </div>
    </main>
  );
}
