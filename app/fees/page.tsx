import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { FEE_NOTE, listFees } from "@/lib/engines/fees";
import { bn } from "@/lib/engines/rules";

export const metadata: Metadata = { title: "সরকারি ফি ও সময়" };

const tk = (n: number) => `${bn(n.toLocaleString("en-IN"))} টাকা`;

export default function FeesPage() {
  const services = listFees();
  return (
    <>
      <PageHeader
        titleBn="সরকারি ফি ও সময়"
        titleEn="Official fees and service times"
        subtitleBn="দালালের দরকার নেই: কোন সেবায় কত সরকারি ফি — প্রতিটি লাইনের সূত্রসহ।"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <p className="rounded-xl bg-amber-50 p-3 text-sm">
          এখানে না থাকা কোনো টাকা সরকারি ফি নয়। বাড়তি টাকা চাইলে ১৬১২২-এ জানান। ফি বদলাতে পারে — এসি
          ল্যান্ড অফিস বা land.gov.bd-তে মিলিয়ে নিন।
          <span lang="en" className="mt-1 block text-xs text-ink-soft">
            {FEE_NOTE}
          </span>
        </p>
        {services.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="rounded-xl border border-line bg-card p-4"
            data-service={s.id}
          >
            <h2 className="text-lg font-semibold">
              {s.bn}{" "}
              <span lang="en" className="text-sm font-normal text-ink-soft">
                {s.en}
              </span>
            </h2>
            {s.items.length ? (
              <table className="mt-2 w-full text-left text-sm">
                <tbody>
                  {s.items.map((i) => (
                    <tr key={i.en} className="border-t border-line">
                      <td className="py-1.5 pr-2">
                        {i.bn}
                        <span className="block text-xs text-ink-soft">{i.when_bn}</span>
                      </td>
                      <td className="py-1.5 text-right font-semibold">{tk(i.tk)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-ink">
                    <td className="py-1.5 font-semibold">মোট</td>
                    <td
                      className="py-1.5 text-right text-lg font-bold"
                      data-testid={`total-${s.id}`}
                    >
                      {tk(s.total_tk!)}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : s.components_bn ? (
              <div className="mt-2 text-sm">
                <p>খরচের অংশ (হার জমির মূল্য ও এলাকা অনুযায়ী, প্রতি বছর বদলায়):</p>
                <ul className="mt-1 list-disc pl-5">
                  {s.components_bn.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-2 text-sm">সময়: {s.time_bn}</p>
            <p className="mt-2 text-xs text-ink-soft">
              সূত্র: {s.source}
              <span className="block">যাচাই: {s.verified}</span>
            </p>
            {s.law_id ? (
              <Link href={`/chat`} className="mt-2 inline-block text-sm text-brand underline">
                এ নিয়ে সাথী এআই-কে জিজ্ঞাসা করুন →
              </Link>
            ) : null}
          </section>
        ))}
      </main>
    </>
  );
}
