import { listFees } from "../engines/fees";

// The land services of "Bhumi shathi.docx" (the 11 services on land.gov.bd) and which ones a
// citizen can already apply for here. One list, read by /services, the application engine,
// the wizard and the AI. Plan and phases: docs/LAND_SERVICES_PLAN.md.

export type ServiceArea =
  | "mutation"
  | "land_tax"
  | "records"
  | "acquisition"
  | "lease"
  | "administration"
  | "revenue_cases"
  | "info_bank"
  | "complaints"
  | "drishti"
  | "naksha";

export interface ServiceAreaInfo {
  id: ServiceArea;
  bn: string;
  en: string;
  hint_bn: string;
  hint_en: string;
  /** Application types already open in BhumiSathi under this area. */
  types: ApplicationTypeId[];
  /** When the rest arrives (plan phase), or null when nothing more is planned. */
  phase: "B" | "C" | "D" | "E" | null;
  /** Already useful pages for this area. */
  links: { href: string; bn: string; en: string }[];
}

export const SERVICE_AREAS: ServiceAreaInfo[] = [
  { id: "mutation", bn: "মিউটেশন / নামজারি", en: "Mutation (namjari)", hint_bn: "ক্রয়, ওয়ারিশ বা বণ্টনের পর নিজের নামে খতিয়ান", hint_en: "A khatian in your name after a purchase, inheritance or partition", types: [], phase: "C", links: [{ href: "/fees", bn: "ফি: ১,১৭০ টাকা", en: "Fee: Tk 1,170" }, { href: "/warish", bn: "ওয়ারিশ হিসাব", en: "Inheritance shares" }] }, // prettier-ignore
  { id: "land_tax", bn: "ভূমি উন্নয়ন কর", en: "Land development tax", hint_bn: "খাজনা হিসাব, পরিশোধ ও দাখিলা", hint_en: "Work out, pay and get the dakhila", types: [], phase: "C", links: [] }, // prettier-ignore
  { id: "records", bn: "ভূমি রেকর্ড ও ম্যাপ", en: "Land records and maps", hint_bn: "খতিয়ানের সার্টিফাইড কপি, মৌজা ম্যাপ", hint_en: "Certified khatian copies, mouza maps", types: ["certified_copy"], phase: "D", links: [{ href: "/map", bn: "মৌজা ম্যাপ", en: "Mouza map" }] }, // prettier-ignore
  { id: "acquisition", bn: "ভূমি অধিগ্রহণ ও হুকুমদখল", en: "Acquisition and requisition", hint_bn: "আমার জমি কি প্রকল্পে পড়েছে? ক্ষতিপূরণ কত?", hint_en: "Is my land in a project? How much compensation?", types: [], phase: "D", links: [] }, // prettier-ignore
  { id: "lease", bn: "ইজারা ও বন্দোবস্ত", en: "Lease and settlement", hint_bn: "খাস জমি, জলমহাল — ভূমিহীনদের জন্য", hint_en: "Khas land and jalmohal, for landless families", types: [], phase: "E", links: [] }, // prettier-ignore
  { id: "administration", bn: "ভূমি প্রশাসন ব্যবস্থাপনা", en: "Land administration", hint_bn: "অফিসের কাজের তালিকা ও সময়সীমা", hint_en: "Office task lists and deadlines", types: [], phase: "E", links: [{ href: "/inbox", bn: "কর্মকর্তার ইনবক্স", en: "Officer inbox" }] }, // prettier-ignore
  { id: "revenue_cases", bn: "ভূমি রাজস্ব মামলা", en: "Land revenue cases", hint_bn: "মামলার শুনানি ও আদেশ অনুসরণ", hint_en: "Follow hearings and orders", types: [], phase: "D", links: [] }, // prettier-ignore
  { id: "info_bank", bn: "ভূমি তথ্য ব্যাংক", en: "Land information bank", hint_bn: "খাস, অর্পিত সম্পত্তি ও জলমহালের তালিকা", hint_en: "Register of khas, vested property and jalmohal", types: [], phase: "D", links: [] }, // prettier-ignore
  { id: "complaints", bn: "কারিগরি সহায়তা ও অভিযোগ", en: "Help and complaints", hint_bn: "দালাল বা বাড়তি টাকা চাইলে অভিযোগ করুন", hint_en: "Report a broker or anyone asking for extra money", types: [], phase: "C", links: [{ href: "/chat", bn: "সাথী এআই", en: "Sathi AI" }] }, // prettier-ignore
  { id: "drishti", bn: "ভূমি দৃষ্টি", en: "Bhumi Drishti", hint_bn: "মাঠ পরিদর্শনের রেকর্ড", hint_en: "Field inspection records", types: [], phase: "E", links: [] }, // prettier-ignore
  { id: "naksha", bn: "ভূমি নকশা", en: "Bhumi Naksha (maps and zones)", hint_bn: "জমির শ্রেণি ও ব্যবহার অঞ্চলের স্তর", hint_en: "Land class and land-use zone layers", types: [], phase: "D", links: [{ href: "/map", bn: "মৌজা ম্যাপ", en: "Mouza map" }] }, // prettier-ignore
];

// ---------- application types ----------

export type ApplicationTypeId = "certified_copy";

export interface FeeLine {
  bn: string;
  en: string;
  tk: number;
}

export interface Step {
  key: string;
  bn: string;
  en: string;
}

export interface ApplicationType {
  id: ApplicationTypeId;
  area: ServiceArea;
  /** Number prefix: CPY-2026-0001. */
  prefix: string;
  bn: string;
  en: string;
  hint_bn: string;
  hint_en: string;
  /** Days the office has after payment (shown as the deadline). */
  sla_days: number;
  documents: { bn: string; en: string }[];
  steps: Step[];
  fee_source: string;
  fee_verified: string;
}

const COMMON_STEPS: Step[] = [
  { key: "submitted", bn: "আবেদন", en: "Applied" },
  { key: "paid", bn: "ফি পরিশোধ", en: "Fee paid" },
  { key: "review", bn: "যাচাই", en: "Review" },
  { key: "decision", bn: "সিদ্ধান্ত", en: "Decision" },
  { key: "document", bn: "ডকুমেন্ট", en: "Document" },
];

const copyFees = listFees().find((f) => f.id === "certified_khatian")!;

export const APPLICATION_TYPES: Record<ApplicationTypeId, ApplicationType> = {
  certified_copy: {
    id: "certified_copy",
    area: "records",
    prefix: "CPY",
    bn: "খতিয়ানের সার্টিফাইড কপি",
    en: "Certified khatian copy",
    hint_bn: "যেকোনো জরিপের (সিএস, এসএ, আরএস, বিএস) খতিয়ানের স্বাক্ষরিত কপি, QR দিয়ে যাচাইযোগ্য।",
    hint_en: "A signed copy of the khatian from any survey (CS, SA, RS, BS), verifiable by QR.",
    sla_days: 7,
    documents: [
      { bn: "মৌজার নাম ও দাগ নম্বর", en: "Mouza name and dag number" },
      {
        bn: "কোন জরিপের খতিয়ান (সিএস / এসএ / আরএস / বিএস)",
        en: "Which survey (CS / SA / RS / BS)",
      },
      { bn: "আবেদনকারীর জাতীয় পরিচয়পত্র (এই ডেমোতে কৃত্রিম)", en: "Applicant's NID (synthetic in this demo)" }, // prettier-ignore
    ],
    steps: COMMON_STEPS,
    fee_source: copyFees.source,
    fee_verified: copyFees.verified,
  },
};

export const SURVEYS = ["CS", "SA", "RS", "BS"] as const;
export type Survey = (typeof SURVEYS)[number];

export interface CopyDetails {
  mouza: string;
  dag_no: number;
  survey: Survey;
  delivery: "online" | "post";
}

/** Fee lines for an application, from content/fees.json (official lines, each with a source). */
export function feeFor(type: ApplicationTypeId, details: CopyDetails): FeeLine[] {
  if (type === "certified_copy") {
    const [copy, postage] = copyFees.items;
    const lines: FeeLine[] = [{ bn: copy!.bn, en: copy!.en, tk: copy!.tk }];
    if (details.delivery === "post") lines.push({ bn: postage!.bn, en: postage!.en, tk: postage!.tk }); // prettier-ignore
    return lines;
  }
  return [];
}

export const STATUS_LABEL: Record<
  string,
  { bn: string; en: string; tone: "amber" | "blue" | "green" | "red" | "grey" }
> = {
  // prettier-ignore
  payment_due: { bn: "ফি পরিশোধ বাকি", en: "Fee due", tone: "amber" },
  in_review: { bn: "অফিসে যাচাই চলছে", en: "Being reviewed", tone: "blue" },
  completed: { bn: "সম্পন্ন — ডকুমেন্ট প্রস্তুত", en: "Done — document ready", tone: "green" },
  rejected: { bn: "নামঞ্জুর", en: "Rejected", tone: "red" },
  cancelled: { bn: "বাতিল", en: "Cancelled", tone: "grey" },
};
