import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { HeroArt } from "@/components/home/HeroArt";
import { LedgerDemo } from "@/components/home/LedgerDemo";
import { NoticeTicker } from "@/components/home/NoticeTicker";
import { QuickCheck } from "@/components/home/QuickCheck";
import { ServiceGrid } from "@/components/home/ServiceGrid";
import { T } from "@/components/i18n/LangProvider";
import { Counter } from "@/components/ui/Counter";
import { Reveal } from "@/components/ui/Reveal";
import {
  IconChat,
  IconLock,
  IconPhone,
  IconPlay,
  IconSeal,
  IconCheckLand,
} from "@/components/ui/icons";
import { listMouzas } from "@/lib/engines/mouzas";

// Home: one question, every way in. A government-portal layout (notice bar, service grid with
// coloured bars, hotline) made friendlier: a quick check right in the hero, a hands-on ledger
// demo, and judge mode one tap away. Bangla first; English with the switch in the header.

const STEPS = [
  { Icon: IconCheckLand, bn: "দাগ নম্বর দিন", en: "Enter a dag number", dBn: "মৌজা বেছে দাগ বা খতিয়ান নম্বর লিখুন — বাংলা বা ইংরেজি অঙ্কে।", dEn: "Pick the mouza and type a dag or khatian number, in Bangla or English digits." }, // prettier-ignore
  { Icon: IconLock, bn: "শেয়ার লেজার যাচাই", en: "Ledger checks every share", dBn: "চার জরিপের খতিয়ান, বায়না, বন্ধক, মামলা ও খাস — সব একসাথে দেখা হয়।", dEn: "Four surveys, bainas, mortgages, court cases and khas land are checked together." }, // prettier-ignore
  { Icon: IconSeal, bn: "রিপোর্ট ও সিল", en: "Report and seal", dBn: "লাল / হলুদ / সবুজ রায়, কারণসহ; চাইলে QR-সহ স্বাক্ষরিত রিপোর্ট।", dEn: "A red / amber / green verdict with reasons, and a signed QR report if you want." }, // prettier-ignore
];

const FAQ = [
  { qBn: "ভূমিসাথী কী?", qEn: "What is BhumiSathi?", aBn: "বাংলায় কথা বলা এক জমি-সহায়ক: জমি কেনার আগে যাচাই, দলিল পড়া, মাপ, ওয়ারিশ হিসাব ও আইন — এক জায়গায়। এটি প্রতিযোগিতার প্রোটোটাইপ; সব তথ্য কাল্পনিক।", aEn: "A land helper that speaks Bangla: checks before you buy, deed reading, measurements, inheritance and the law — in one place. It is a competition prototype; all data is synthetic." }, // prettier-ignore
  { qBn: "একই জমি দুইবার বিক্রি কীভাবে আটকায়?", qEn: "How is a double sale stopped?", aBn: "প্রতিটি দাগের প্রতিটি অংশ একটি শেয়ার লেজারে থাকে। বায়না, বিক্রি বা বন্ধক নিবন্ধনের সময় ডাটাবেস লক করে হিসাব করে — বিক্রয়যোগ্য অংশের বেশি কখনও নিবন্ধিত হয় না।", aEn: "Every share of every dag sits in a share ledger. A baina, sale or mortgage is recorded under a database lock, so nothing beyond the sellable share can ever be registered." }, // prettier-ignore
  { qBn: "সাথী এআই কি আইনি পরামর্শ দেয়?", qEn: "Does Sathi AI give legal advice?", aBn: "সাথী আইনের নির্দিষ্ট ধারা উল্লেখ করে ব্যাখ্যা দেয়, কিন্তু মালিকানার রায় দেয় না। উৎস না থাকলে তা বলে দেয় এবং ১৬১২২ বা আইনজীবীর কাছে যেতে বলে।", aEn: "Sathi explains with the exact law sections cited, but never decides ownership. If it has no source it says so and points you to 16122 or a lawyer." }, // prettier-ignore
  { qBn: "আমার তথ্য কি নিরাপদ?", qEn: "Is my data safe?", aBn: "এনআইডি ও ফোন নম্বর এআই-কে পাঠানো হয় না; প্রত্যেক নাগরিক শুধু নিজের দলিল দেখতে পারেন; কে কখন জমি দেখেছে তা অপরিবর্তনীয় অডিট লগে থাকে।", aEn: "NID and phone numbers are never sent to the AI; each citizen sees only their own deeds; every look at a plot goes into a tamper-evident audit log." }, // prettier-ignore
  { qBn: "সিলযুক্ত রিপোর্ট কী?", qEn: "What is a sealed report?", aBn: "ডিজিটাল স্বাক্ষর (Ed25519) করা জমির রিপোর্ট, QR কোডসহ। ব্যাংক বা ক্রেতা স্ক্যান করে চারটি বাতি দেখেন: আসল, হালনাগাদ, অক্ষত, অংশের যোগফল মেলে।", aEn: "A digitally signed (Ed25519) land report with a QR code. A bank or buyer scans it and sees four lights: genuine, current, untouched, shares add up." }, // prettier-ignore
];

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="bg-alpana relative overflow-hidden text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:py-14 lg:grid-cols-[1.15fr_1fr]">
          <div className="min-w-0">
            <p className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm ring-1 ring-white/20">
              <span className="h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
              <T bn="ভূমি সেবা, এখন আপনার সাথী" en="Land services, now your companion" />
            </p>
            <h1 className="animate-fade-up mt-4 text-4xl font-bold leading-tight [animation-delay:60ms] sm:text-5xl">
              <T bn="ভূমিসাথী — এক জমি, এক সত্য" en="BhumiSathi — one plot, one truth" />
            </h1>
            <p className="animate-fade-up mt-4 max-w-xl text-lg text-white/90 [animation-delay:120ms]">
              <T
                bn="জমি কেনার আগে যাচাই, দলিল পড়া, মাপ, ওয়ারিশের হিসাব ও আইনি তথ্য — বাংলায় লিখে বা বলে।"
                en="Check land before you buy, read deeds, measure plots, split inheritance and learn the law — by typing or speaking Bangla."
              />
            </p>
            <div className="animate-fade-up mt-6 [animation-delay:180ms]">
              <Suspense fallback={<div className="h-40 rounded-2xl bg-white/10" />}>
                <QuickCheckWithMouzas />
              </Suspense>
            </div>
            <div className="animate-fade-up mt-5 flex flex-wrap gap-3 [animation-delay:240ms]">
              <Link
                href="/judge"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-5 font-semibold text-ink shadow-lg transition-transform hover:scale-[1.03]"
              >
                <IconPlay className="h-5 w-5" />
                <T bn="জাজ মোড — ৩ মিনিটে দেখুন" en="Judge mode — see it in 3 minutes" />
              </Link>
              <Link
                href="/chat"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/10 px-5 font-semibold ring-1 ring-white/40 hover:bg-white/20"
              >
                <IconChat className="h-5 w-5" />
                <T bn="সাথী এআই-কে জিজ্ঞাসা করুন" en="Ask Sathi AI" />
              </Link>
            </div>
          </div>
          <HeroArt />
        </div>
      </section>

      <NoticeTicker />

      {/* Numbers */}
      <section aria-label="এক নজরে / At a glance" className="bg-card">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 divide-line px-4 py-6 text-center sm:grid-cols-4 sm:divide-x">
          {[
            { n: 60, bn: "দাগ (কাল্পনিক মৌজা)", en: "dags (synthetic mouzas)" },
            { n: 4, bn: "জরিপ: সিএস থেকে বিএস", en: "surveys: CS to BS" },
            { n: 17, bn: "যাচাই ও এআই টুল", en: "check and AI tools" },
            { n: 0, bn: "দ্বৈত বিক্রি সম্ভব", en: "double sales possible" },
          ].map((s) => (
            <li key={s.bn} className="px-2 py-2">
              <p className="text-3xl font-bold text-brand-deep sm:text-4xl">
                <Counter to={s.n} />
              </p>
              <p className="text-sm text-ink-soft">
                <T bn={s.bn} en={s.en} />
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Services */}
      <section aria-labelledby="services-title" className="mx-auto w-full max-w-6xl px-4 py-12">
        <Reveal className="text-center">
          <h2 id="services-title" className="text-2xl font-bold sm:text-3xl">
            <T bn="ভূমি সংক্রান্ত সেবা" en="Land services" />
          </h2>
          <p className="mt-1 text-ink-soft">
            <T bn="আপনি কী করতে চান? একটি বেছে নিন।" en="What would you like to do? Pick one." />
          </p>
        </Reveal>
        <div className="mt-6">
          <ServiceGrid />
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-title" className="bg-card py-12">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="text-center">
            <h2 id="how-title" className="text-2xl font-bold sm:text-3xl">
              <T bn="কীভাবে কাজ করে" en="How it works" />
            </h2>
          </Reveal>
          <ol className="relative mt-8 grid gap-6 md:grid-cols-3">
            <span
              className="absolute left-[16%] right-[16%] top-8 hidden h-0.5 bg-gradient-to-r from-brand/10 via-brand/40 to-brand/10 md:block"
              aria-hidden="true"
            />
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.bn} delay={i * 120} className="relative text-center">
                <span className="relative mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white shadow-lg">
                  <s.Icon className="h-8 w-8" />
                  <span className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
                    <T bn={["১", "২", "৩"][i]!} en={String(i + 1)} />
                  </span>
                </span>
                <p className="mt-3 text-lg font-semibold">
                  <T bn={s.bn} en={s.en} />
                </p>
                <p className="mx-auto max-w-xs text-sm text-ink-soft">
                  <T bn={s.dBn} en={s.dEn} />
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Ledger demo */}
      <section
        aria-labelledby="ledger-title"
        className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-12 lg:grid-cols-2"
      >
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            <T bn="নিজে চেষ্টা করুন" en="Try it yourself" />
          </p>
          <h2 id="ledger-title" className="mt-1 text-2xl font-bold sm:text-3xl">
            <T bn="একই জমি দুইবার বিক্রি — আর নয়" en="The same land, sold twice — never again" />
          </h2>
          <p className="mt-3 text-ink-soft">
            <T
              bn="বাংলাদেশে জমি নিয়ে অনেক মামলার শুরু একই জমি একাধিকবার বিক্রি থেকে। ভূমিসাথীর শেয়ার লেজার প্রতিটি অংশের হিসাব রাখে — বায়না হলে ওই অংশ আটকে যায়, বেশি বিক্রির চেষ্টা সঙ্গে সঙ্গে থামে।"
              en="Many land disputes start with one plot sold more than once. BhumiSathi's share ledger keeps account of every share: a baina locks its portion, and any attempt to sell more is stopped on the spot."
            />
          </p>
        </Reveal>
        <Reveal delay={120}>
          <LedgerDemo />
        </Reveal>
      </section>

      {/* FAQ + hotline */}
      <section aria-labelledby="faq-title" className="bg-card py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[1fr_20rem]">
          <div>
            <h2 id="faq-title" className="text-2xl font-bold sm:text-3xl">
              <T bn="সচরাচর জিজ্ঞাসা" en="Frequently asked" />
            </h2>
            <div className="mt-4 space-y-2">
              {FAQ.map((f) => (
                <details
                  key={f.qBn}
                  className="group rounded-xl border border-line bg-paper open:bg-card open:shadow-sm"
                >
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                    <T bn={f.qBn} en={f.qEn} />
                    <span
                      className="text-xl text-brand transition-transform group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="px-4 pb-4 text-ink-soft">
                    <T bn={f.aBn} en={f.aEn} />
                  </p>
                </details>
              ))}
            </div>
          </div>
          <aside className="bg-alpana self-start rounded-3xl p-6 text-white shadow-lg">
            <IconPhone className="h-10 w-10 text-gold" />
            <p className="mt-3 text-lg">
              <T bn="ভূমিসেবা সহায়তার জন্য কল করুন" en="For land service help, call" />
            </p>
            <a href="tel:16122" className="mt-1 block text-5xl font-bold tracking-wide">
              <T bn="১৬১২২" en="16122" />
            </a>
            <p className="mt-3 text-sm text-white/80">
              <T
                bn="অথবা এখনই সাথী এআই-কে বাংলায় জিজ্ঞাসা করুন।"
                en="Or ask Sathi AI in Bangla right now."
              />
            </p>
            <Link
              href="/chat"
              className="mt-4 inline-flex min-h-11 items-center rounded-full bg-white px-4 font-semibold text-brand-deep"
            >
              <T bn="সাথীকে জিজ্ঞাসা করুন" en="Ask Sathi" />
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}

async function QuickCheckWithMouzas() {
  await connection(); // mouzas come from the database at request time
  return <QuickCheck mouzas={await listMouzas()} />;
}
