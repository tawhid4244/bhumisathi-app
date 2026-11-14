"use client";

import Link from "next/link";

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
      <h1 className="text-2xl font-bold">দুঃখিত, একটি সমস্যা হয়েছে</h1>
      <p lang="en" className="text-ink-soft">
        Sorry, something went wrong.
      </p>
      <p className="mt-3">আবার চেষ্টা করুন। সমস্যা থাকলে কিছুক্ষণ পরে আসুন।</p>
      {error.digest ? <p className="mt-2 text-xs text-ink-soft">কোড: {error.digest}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-lg bg-brand px-4 font-semibold text-white"
        >
          আবার চেষ্টা করুন
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4"
        >
          হোমে যান
        </Link>
      </div>
    </main>
  );
}
