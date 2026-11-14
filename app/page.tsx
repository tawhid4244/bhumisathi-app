import Link from "next/link";
import { Suspense } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { UserBar } from "@/components/auth/UserBar";

// Home: one question, every way in. Bangla first, English second.
// "Ask Sathi" comes first: one conversation can do everything below.
const journeys = [
  {
    href: "/chat",
    bn: "সাথী এআই-কে জিজ্ঞাসা করুন",
    en: "Ask Sathi AI",
    hint: "বাংলায় লিখুন বা কথা বলুন — যাচাই, দলিল, মাপ, আইন সব এক জায়গায়",
  },
  {
    href: "/check",
    bn: "জমি যাচাই",
    en: "Check land before you buy",
    hint: "দাগ নম্বর দিয়ে লাল / হলুদ / সবুজ রিপোর্ট",
  },
  {
    href: "/deed",
    bn: "দলিল পড়ুন",
    en: "Read a deed",
    hint: "দলিলের ছবি দিন — সহজ বাংলায় ব্যাখ্যা ও রেকর্ডের সাথে মিলিয়ে দেখা",
  },
  {
    href: "/map",
    bn: "মৌজা ম্যাপে মাপ",
    en: "Measure on the mouza map",
    hint: "দাগের আয়তন শতক, কাঠা ও বিঘায়",
  },
  {
    href: "/warish",
    bn: "ওয়ারিশ হিসাব",
    en: "Inheritance shares",
    hint: "ফারায়েজ অনুযায়ী প্রতিটি দাগে প্রত্যেকের অংশ",
  },
  {
    href: "/units",
    bn: "জমির একক রূপান্তর",
    en: "Land unit converter",
    hint: "কানি, গন্ডা, বিঘা, কাঠা → শতক ও একর",
  },
  {
    href: "/fees",
    bn: "সরকারি ফি ও সময়",
    en: "Official fees and times",
    hint: "নামজারি ১,১৭০ টাকা — দালাল ছাড়াই জানুন",
  },
  {
    href: "/verify",
    bn: "সিলযুক্ত রিপোর্ট যাচাই",
    en: "Verify a sealed report",
    hint: "QR স্ক্যান করে দেখুন রিপোর্ট আসল ও হালনাগাদ কি না",
  },
  {
    href: "/my-land",
    bn: "আমার জমি কে দেখেছে",
    en: "Who checked my land",
    hint: "আপনার দাগের প্রতিটি যাচাই ও নিবন্ধনের চেষ্টা অডিট লগে",
  },
  {
    href: "/registry",
    bn: "সাব-রেজিস্ট্রি ডেমো",
    en: "Sub-registry demo",
    hint: "একই জমি দুইবার বিক্রি আটকানো",
  },
] as const;

export default function Home() {
  return (
    <>
      <header className="bg-ink px-4 pb-8 pt-3 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="flex min-h-11 justify-end">
            <Suspense fallback={null}>
              <UserBar />
            </Suspense>
          </div>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">ভূমিসাথী — এক জমি, এক সত্য</h1>
          <p lang="en" className="mt-1 text-white/80">
            BhumiSathi — one plot, one truth
          </p>
          <p className="mt-4 max-w-xl text-white/90">
            জমি কেনার আগে যাচাই, ওয়ারিশের হিসাব, মাপ ও আইনি তথ্য — এক জায়গায়, বাংলায়।
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h2 className="text-xl font-semibold">আপনি কী করতে চান?</h2>
        <p lang="en" className="text-sm text-ink-soft">
          What would you like to do?
        </p>

        <nav aria-label="প্রধান সেবা / Main services" className="mt-5">
          <ul className="grid gap-3 sm:grid-cols-2">
            {journeys.map((j) => (
              <li key={j.href}>
                <Link
                  href={j.href}
                  className="flex min-h-20 flex-col justify-center rounded-xl border border-line bg-card p-4 shadow-sm transition hover:border-brand hover:bg-brand-soft"
                >
                  <span className="text-lg font-semibold">{j.bn}</span>
                  <span lang="en" className="text-sm text-ink-soft">
                    {j.en}
                  </span>
                  <span className="mt-1 text-sm text-ink-soft">{j.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>

      <SiteFooter />
    </>
  );
}
