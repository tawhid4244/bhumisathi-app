import {
  IconChat,
  IconCheckLand,
  IconDeed,
  IconEye,
  IconFamily,
  IconForm,
  IconInbox,
  IconMap,
  IconRegistry,
  IconScale,
  IconSeal,
  IconTaka,
} from "../ui/icons";

// Every BhumiSathi service, once. The header menu, the home page and the footer read from here.

export type Audience = "citizen" | "office";

export interface Service {
  href: string;
  bn: string;
  en: string;
  hintBn: string;
  hintEn: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  /** Colour of the card's top bar (government-portal style). */
  bar: string;
  tint: string;
  audience: Audience;
  inMenu?: boolean;
}

export const SERVICES: Service[] = [
  { href: "/check", bn: "জমি যাচাই", en: "Check land", hintBn: "দাগ নম্বর দিয়ে লাল / হলুদ / সবুজ রিপোর্ট", hintEn: "Red / amber / green report from a dag number", Icon: IconCheckLand, bar: "bg-[#0d7a58]", tint: "text-[#0d7a58] bg-[#e3f1ea]", audience: "citizen", inMenu: true }, // prettier-ignore
  { href: "/services", bn: "সেবা ও আবেদন", en: "Services", hintBn: "খতিয়ানের কপি ও অন্যান্য সেবায় আবেদন, ফি ও অবস্থা", hintEn: "Apply for khatian copies and more; pay and track", Icon: IconForm, bar: "bg-[#0b5d3b]", tint: "text-[#0b5d3b] bg-[#e0efe7]", audience: "citizen", inMenu: true }, // prettier-ignore
  { href: "/chat", bn: "সাথী এআই", en: "Sathi AI", hintBn: "বাংলায় লিখুন বা বলুন — যাচাই, দলিল, মাপ, আইন", hintEn: "Type or speak in Bangla: checks, deeds, maps, law", Icon: IconChat, bar: "bg-[#1f4fd1]", tint: "text-[#1f4fd1] bg-[#e7edfc]", audience: "citizen", inMenu: true }, // prettier-ignore
  { href: "/deed", bn: "দলিল পড়ুন", en: "Read a deed", hintBn: "ছবি দিন — সহজ বাংলায় ব্যাখ্যা ও রেকর্ডের সাথে মিল", hintEn: "Photo → plain Bangla, matched with the records", Icon: IconDeed, bar: "bg-[#0aa2c0]", tint: "text-[#08788f] bg-[#e1f5f9]", audience: "citizen", inMenu: true }, // prettier-ignore
  { href: "/map", bn: "মৌজা ম্যাপ", en: "Mouza map", hintBn: "দাগের মাপ শতক, কাঠা ও বিঘায়", hintEn: "A dag's area in decimals, katha and bigha", Icon: IconMap, bar: "bg-[#d4145a]", tint: "text-[#b0104a] bg-[#fbe6ee]", audience: "citizen", inMenu: true }, // prettier-ignore
  { href: "/warish", bn: "ওয়ারিশ হিসাব", en: "Inheritance", hintBn: "ফারায়েজ অনুযায়ী প্রতিটি দাগে অংশ", hintEn: "Faraid shares on every dag", Icon: IconFamily, bar: "bg-[#7a2bb8]", tint: "text-[#6a22a3] bg-[#f1e8f9]", audience: "citizen", inMenu: true }, // prettier-ignore
  { href: "/verify", bn: "রিপোর্ট যাচাই", en: "Verify a report", hintBn: "QR স্ক্যান করে দেখুন আসল ও হালনাগাদ কি না", hintEn: "Scan the QR: genuine and current?", Icon: IconSeal, bar: "bg-[#e4253b]", tint: "text-[#c21a2f] bg-[#fde8eb]", audience: "citizen" }, // prettier-ignore
  { href: "/units", bn: "জমির একক", en: "Land units", hintBn: "কানি, গন্ডা, বিঘা, কাঠা → শতক ও একর", hintEn: "Kani, gonda, bigha, katha → decimals, acres", Icon: IconScale, bar: "bg-[#2f8f3a]", tint: "text-[#2a7d33] bg-[#e7f4e8]", audience: "citizen" }, // prettier-ignore
  { href: "/fees", bn: "সরকারি ফি ও সময়", en: "Fees and times", hintBn: "নামজারি ১,১৭০ টাকা — দালাল ছাড়াই জানুন", hintEn: "Mutation Tk 1,170 — know it without a broker", Icon: IconTaka, bar: "bg-[#e08a00]", tint: "text-[#9a5c00] bg-[#fdf1dc]", audience: "citizen" }, // prettier-ignore
  { href: "/my-land", bn: "আমার জমি কে দেখেছে", en: "Who checked my land", hintBn: "আপনার দাগের প্রতিটি যাচাই অডিট লগে", hintEn: "Every look at your dag, in the audit log", Icon: IconEye, bar: "bg-[#0f6e8c]", tint: "text-[#0f6e8c] bg-[#e2f1f6]", audience: "citizen" }, // prettier-ignore
  { href: "/track", bn: "আবেদনের অবস্থা", en: "Track an application", hintBn: "আবেদন নম্বর দিয়ে লগইন ছাড়াই", hintEn: "By application number, no sign-in", Icon: IconSeal, bar: "bg-[#5a6b10]", tint: "text-[#4a5a0c] bg-[#eef2dc]", audience: "citizen" }, // prettier-ignore
  { href: "/registry", bn: "সাব-রেজিস্ট্রি ডেমো", en: "Sub-registry demo", hintBn: "একই জমি দুইবার বিক্রি আটকানো", hintEn: "One plot can never be sold twice", Icon: IconRegistry, bar: "bg-[#14261f]", tint: "text-[#14261f] bg-[#e6ebe8]", audience: "office" }, // prettier-ignore
  { href: "/inbox", bn: "কর্মকর্তার ইনবক্স", en: "Officer inbox", hintBn: "আবেদনে সিদ্ধান্ত, সময়সীমাসহ", hintEn: "Decide applications, with deadlines", Icon: IconInbox, bar: "bg-[#3d3d8f]", tint: "text-[#3d3d8f] bg-[#e8e8f6]", audience: "office" }, // prettier-ignore
];
