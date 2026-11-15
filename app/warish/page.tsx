import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { WarishCalculator } from "@/components/warish/WarishCalculator";
import { listDeceasedWithLand } from "@/lib/engines/warish-land";

export const metadata: Metadata = { title: "ওয়ারিশ হিসাব" };

export default function WarishPage(props: PageProps<"/warish">) {
  return (
    <>
      <PageHeader
        titleBn="ওয়ারিশ হিসাব"
        titleEn="Inheritance (warish) shares per dag"
        subtitleBn="ফারায়েজ অনুযায়ী প্রত্যেক ওয়ারিশ — মেয়ে ও স্ত্রীসহ — প্রতিটি দাগে কত শতক পাবেন।"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-ink-soft">লোড হচ্ছে… Loading…</p>}>
          <Calculator searchParams={props.searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Calculator({ searchParams }: Pick<PageProps<"/warish">, "searchParams">) {
  await connection(); // always read the current records
  const owner = Number((await searchParams).owner);
  return (
    <WarishCalculator
      deceased={await listDeceasedWithLand()}
      initialOwnerId={Number.isInteger(owner) && owner > 0 ? owner : undefined}
    />
  );
}
