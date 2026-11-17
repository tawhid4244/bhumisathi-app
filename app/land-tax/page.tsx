import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { T } from "@/components/i18n/LangProvider";
import { LandTaxLookup, TaxTable } from "@/components/services/LandTax";
import { currentUser } from "@/lib/auth/current";
import type { TaxReport } from "@/lib/engines/land-tax";
import { listMouzas } from "@/lib/engines/mouzas";
import { runTool } from "@/lib/tools/registry";

export const metadata: Metadata = { title: "ভূমি উন্নয়ন কর" };

// Land development tax: anyone can work it out; paying or taking the dakhila needs a sign-in.
export default function LandTaxPage() {
  return (
    <>
      <PageHeader
        titleBn="ভূমি উন্নয়ন কর ও দাখিলা"
        titleEn="Land development tax and dakhila"
        subtitleBn="কোন অর্থবছর বাকি, কত টাকা আর কোন নিয়মে — তারপর পরিশোধ (পরীক্ষামূলক) ও QR-যুক্ত দাখিলা।"
        subtitleEn="Which fiscal years are due, how much and under which rule — then pay (sandbox) and get a dakhila with a QR."
      />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6">
        <Suspense fallback={<p className="text-ink-soft">লোড হচ্ছে… Loading…</p>}>
          <Content />
        </Suspense>
      </main>
    </>
  );
}

async function Content() {
  await connection();
  const user = await currentUser();
  const [mouzas, mine] = await Promise.all([
    listMouzas(),
    user?.owner_id
      ? (runTool("land_tax_due", {}, { user }) as Promise<{ reports: TaxReport[] }>)
      : Promise.resolve(null),
  ]);
  return (
    <>
      {mine && mine.reports.length ? (
        <section aria-labelledby="mine-h" className="space-y-3">
          <h2 id="mine-h" className="text-xl font-bold">
            <T bn="আমার জমির খাজনা" en="Tax on my land" />
          </h2>
          {mine.reports.map((r) => (
            <TaxTable key={r.dag_id} report={r} />
          ))}
        </section>
      ) : null}
      <section aria-labelledby="any-h" className="space-y-3">
        <h2 id="any-h" className="text-xl font-bold">
          <T bn="যেকোনো দাগের কর দেখুন" en="Look up any dag" />
        </h2>
        <LandTaxLookup mouzas={mouzas} />
      </section>
    </>
  );
}
