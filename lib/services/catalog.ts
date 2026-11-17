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
  { id: "mutation", bn: "মিউটেশন / নামজারি", en: "Mutation (namjari)", hint_bn: "ক্রয়, ওয়ারিশ বা বণ্টনের পর নিজের নামে খতিয়ান", hint_en: "A khatian in your name after a purchase, inheritance or partition", types: ["mutation"], phase: "D", links: [{ href: "/fees", bn: "ফি: ১,১৭০ টাকা", en: "Fee: Tk 1,170" }, { href: "/warish", bn: "ওয়ারিশ হিসাব", en: "Inheritance shares" }] }, // prettier-ignore
  { id: "land_tax", bn: "ভূমি উন্নয়ন কর", en: "Land development tax", hint_bn: "খাজনা হিসাব, পরিশোধ ও দাখিলা", hint_en: "Work out, pay and get the dakhila", types: [], phase: null, links: [{ href: "/land-tax", bn: "কর হিসাব, পরিশোধ ও দাখিলা", en: "Work out, pay, get the dakhila" }] }, // prettier-ignore
  { id: "records", bn: "ভূমি রেকর্ড ও ম্যাপ", en: "Land records and maps", hint_bn: "খতিয়ানের সার্টিফাইড কপি, মৌজা ম্যাপ", hint_en: "Certified khatian copies, mouza maps", types: ["certified_copy"], phase: "D", links: [{ href: "/map", bn: "মৌজা ম্যাপ", en: "Mouza map" }] }, // prettier-ignore
  { id: "acquisition", bn: "ভূমি অধিগ্রহণ ও হুকুমদখল", en: "Acquisition and requisition", hint_bn: "আমার জমি কি প্রকল্পে পড়েছে? ক্ষতিপূরণ কত?", hint_en: "Is my land in a project? How much compensation?", types: [], phase: "D", links: [] }, // prettier-ignore
  { id: "lease", bn: "ইজারা ও বন্দোবস্ত", en: "Lease and settlement", hint_bn: "খাস জমি, জলমহাল — ভূমিহীনদের জন্য", hint_en: "Khas land and jalmohal, for landless families", types: [], phase: "E", links: [] }, // prettier-ignore
  { id: "administration", bn: "ভূমি প্রশাসন ব্যবস্থাপনা", en: "Land administration", hint_bn: "অফিসের কাজের তালিকা ও সময়সীমা", hint_en: "Office task lists and deadlines", types: [], phase: "E", links: [{ href: "/inbox", bn: "কর্মকর্তার ইনবক্স", en: "Officer inbox" }] }, // prettier-ignore
  { id: "revenue_cases", bn: "ভূমি রাজস্ব মামলা", en: "Land revenue cases", hint_bn: "মামলার শুনানি ও আদেশ অনুসরণ", hint_en: "Follow hearings and orders", types: [], phase: "D", links: [] }, // prettier-ignore
  { id: "info_bank", bn: "ভূমি তথ্য ব্যাংক", en: "Land information bank", hint_bn: "খাস, অর্পিত সম্পত্তি ও জলমহালের তালিকা", hint_en: "Register of khas, vested property and jalmohal", types: [], phase: "D", links: [] }, // prettier-ignore
  { id: "complaints", bn: "কারিগরি সহায়তা ও অভিযোগ", en: "Help and complaints", hint_bn: "দালাল বা বাড়তি টাকা চাইলে অভিযোগ করুন", hint_en: "Report a broker or anyone asking for extra money", types: ["complaint"], phase: null, links: [{ href: "/complaints", bn: "মাসিক পরিসংখ্যান", en: "Monthly statistics" }, { href: "/chat", bn: "সাথী এআই-কে বলুন", en: "Tell Sathi AI" }] }, // prettier-ignore
  { id: "drishti", bn: "ভূমি দৃষ্টি", en: "Bhumi Drishti", hint_bn: "মাঠ পরিদর্শনের রেকর্ড", hint_en: "Field inspection records", types: [], phase: "E", links: [] }, // prettier-ignore
  { id: "naksha", bn: "ভূমি নকশা", en: "Bhumi Naksha (maps and zones)", hint_bn: "জমির শ্রেণি ও ব্যবহার অঞ্চলের স্তর", hint_en: "Land class and land-use zone layers", types: [], phase: "D", links: [{ href: "/map", bn: "মৌজা ম্যাপ", en: "Mouza map" }] }, // prettier-ignore
];

// ---------- application types ----------

export type ApplicationTypeId = "certified_copy" | "mutation" | "land_tax" | "complaint";

export interface FeeLine {
  bn: string;
  en: string;
  tk: number;
  /** apply (default): paid when applying · approval: paid after the office approves (mutation DCR). */
  stage?: "apply" | "approval";
}

export interface Step {
  key: string;
  bn: string;
  en: string;
}

export type AppStatus =
  | "payment_due"
  | "in_review"
  | "hearing"
  | "final_payment_due"
  | "completed"
  | "rejected"
  | "cancelled";

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
  /**
   * review: the office reviews and decides (copy, mutation, complaint).
   * auto:   paying (or nothing to pay) issues the document at once (land tax dakhila).
   */
  flow: "review" | "auto";
  /** The office may call a hearing before deciding. */
  hearing?: boolean;
  documents: { bn: string; en: string }[];
  steps: Step[];
  /** How many steps are done in each status (the stepper). */
  progress: Partial<Record<AppStatus, number>>;
  /** Wording that differs from the general status labels. */
  labels?: Partial<Record<AppStatus, { bn: string; en: string }>>;
  /** What the officer's approve button says. */
  approve_bn: string;
  approve_en: string;
  fee_source: string;
  fee_verified: string;
}

const fees = listFees();
const copyFees = fees.find((f) => f.id === "certified_khatian")!;
const mutationFees = fees.find((f) => f.id === "mutation")!;

const s = (key: string, bn: string, en: string): Step => ({ key, bn, en });

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
    flow: "review",
    documents: [
      { bn: "মৌজার নাম ও দাগ নম্বর", en: "Mouza name and dag number" },
      { bn: "কোন জরিপের খতিয়ান (সিএস / এসএ / আরএস / বিএস)", en: "Which survey (CS / SA / RS / BS)" }, // prettier-ignore
      { bn: "আবেদনকারীর জাতীয় পরিচয়পত্র (এই ডেমোতে কৃত্রিম)", en: "Applicant's NID (synthetic in this demo)" }, // prettier-ignore
    ],
    steps: [s("submitted", "আবেদন", "Applied"), s("paid", "ফি পরিশোধ", "Fee paid"), s("review", "যাচাই", "Review"), s("decision", "সিদ্ধান্ত", "Decision"), s("document", "ডকুমেন্ট", "Document")], // prettier-ignore
    progress: { payment_due: 1, in_review: 2, completed: 5, rejected: 4, cancelled: 1 },
    approve_bn: "মঞ্জুর ও কপি ইস্যু",
    approve_en: "Approve and issue",
    fee_source: copyFees.source,
    fee_verified: copyFees.verified,
  },
  mutation: {
    id: "mutation",
    area: "mutation",
    prefix: "MUT",
    bn: "নামজারি (মিউটেশন) — ক্রয়সূত্রে",
    en: "Mutation (namjari) — after a purchase",
    hint_bn: "নিবন্ধিত বিক্রয় দলিলের পর ক্রেতার নামে নতুন খতিয়ান। শুনানির পর এসি ল্যান্ড অনুমোদন দেন।",
    hint_en: "A new khatian in the buyer's name after a registered sale deed. The AC Land approves after a hearing.", // prettier-ignore
    sla_days: 28,
    flow: "review",
    hearing: true,
    documents: [
      { bn: "নিবন্ধিত দলিলের নম্বর (যেমন ৫০০১/২০২৬)", en: "Registered deed number (e.g. 5001/2026)" }, // prettier-ignore
      { bn: "বিক্রেতার খতিয়ান ও হালনাগাদ দাখিলা", en: "The seller's khatian and a current tax receipt (dakhila)" }, // prettier-ignore
      { bn: "ক্রেতার জাতীয় পরিচয়পত্র (এই ডেমোতে কৃত্রিম)", en: "The buyer's NID (synthetic in this demo)" }, // prettier-ignore
    ],
    steps: [s("submitted", "আবেদন", "Applied"), s("paid", "আবেদন ফি", "Fee paid"), s("hearing", "শুনানি", "Hearing"), s("order", "আদেশ", "Order"), s("dcr", "ডিসিআর ফি", "DCR fee"), s("khatian", "নতুন খতিয়ান", "New khatian")], // prettier-ignore
    progress: { payment_due: 1, in_review: 2, hearing: 2, final_payment_due: 4, completed: 6, rejected: 4, cancelled: 1 }, // prettier-ignore
    labels: {
      in_review: { bn: "এসি ল্যান্ড অফিসে যাচাই", en: "With the AC Land office" },
      hearing: { bn: "শুনানি নির্ধারিত", en: "Hearing scheduled" },
      final_payment_due: { bn: "অনুমোদিত — ডিসিআর ফি বাকি", en: "Approved — DCR fee due" },
      completed: { bn: "নামজারি সম্পন্ন — নতুন খতিয়ান", en: "Mutation done — new khatian" },
    },
    approve_bn: "নামজারি অনুমোদন",
    approve_en: "Approve mutation",
    fee_source: mutationFees.source,
    fee_verified: mutationFees.verified,
  },
  land_tax: {
    id: "land_tax",
    area: "land_tax",
    prefix: "LDT",
    bn: "ভূমি উন্নয়ন কর ও দাখিলা",
    en: "Land development tax and dakhila",
    hint_bn: "বকেয়া কর হিসাব, পরিশোধ (পরীক্ষামূলক) এবং QR-যুক্ত স্বাক্ষরিত দাখিলা।",
    hint_en: "Work out the tax due, pay (sandbox) and get a signed dakhila with a QR.",
    sla_days: 0,
    flow: "auto",
    documents: [],
    steps: [s("calc", "হিসাব", "Worked out"), s("paid", "পরিশোধ", "Paid"), s("dakhila", "দাখিলা", "Dakhila")], // prettier-ignore
    progress: { payment_due: 1, completed: 3, cancelled: 1 },
    labels: { completed: { bn: "পরিশোধিত — দাখিলা প্রস্তুত", en: "Paid — dakhila ready" } },
    approve_bn: "",
    approve_en: "",
    fee_source: "content/land-tax.json",
    fee_verified: "Exemption up to 25 bigha: from news reports of the 2023 Act. Non-agricultural rates: examples, not verified.", // prettier-ignore
  },
  complaint: {
    id: "complaint",
    area: "complaints",
    prefix: "CMP",
    bn: "অভিযোগ",
    en: "Complaint",
    hint_bn: "দালাল, বাড়তি টাকা, দেরি বা ভুল রেকর্ড — নাম গোপন রেখেও জানাতে পারেন।",
    hint_en: "A broker, extra money, delay or a wrong record — you can stay anonymous.",
    sla_days: 7,
    flow: "review",
    documents: [],
    steps: [s("filed", "দাখিল", "Filed"), s("review", "অফিসে যাচাই", "Office review"), s("resolved", "নিষ্পত্তি", "Resolved")], // prettier-ignore
    progress: { in_review: 1, completed: 3, rejected: 3 },
    labels: {
      in_review: { bn: "অভিযোগ যাচাই চলছে", en: "Being looked into" },
      completed: { bn: "নিষ্পত্তি হয়েছে", en: "Resolved" },
      rejected: { bn: "বন্ধ (কারণসহ)", en: "Closed (with a reason)" },
    },
    approve_bn: "নিষ্পত্তি করুন",
    approve_en: "Resolve",
    fee_source: "",
    fee_verified: "",
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
export function feeFor(type: ApplicationTypeId, details: Record<string, unknown>): FeeLine[] {
  if (type === "certified_copy") {
    const [copy, postage] = copyFees.items;
    const lines: FeeLine[] = [{ bn: copy!.bn, en: copy!.en, tk: copy!.tk }];
    if (details.delivery === "post") lines.push({ bn: postage!.bn, en: postage!.en, tk: postage!.tk }); // prettier-ignore
    return lines;
  }
  if (type === "mutation") {
    // court fee + notice fee when applying; record correction + khatian copy (DCR) after approval
    return mutationFees.items.map((i, n) => ({ bn: i.bn, en: i.en, tk: i.tk, stage: n < 2 ? "apply" : "approval" })); // prettier-ignore
  }
  if (type === "land_tax") {
    const due = Number(details.due_tk ?? 0);
    const years = (details.years_due as string[] | undefined) ?? [];
    if (due <= 0) return [];
    const span = years.length > 1 ? `${years[0]} … ${years.at(-1)}` : (years[0] ?? "");
    return [{ bn: `ভূমি উন্নয়ন কর (${span})`, en: `Land development tax (${span})`, tk: due }];
  }
  return [];
}

export const applyFee = (lines: FeeLine[]) =>
  lines.filter((l) => (l.stage ?? "apply") === "apply").reduce((t, l) => t + l.tk, 0);
export const approvalFee = (lines: FeeLine[]) =>
  lines.filter((l) => l.stage === "approval").reduce((t, l) => t + l.tk, 0);

export const STATUS_LABEL: Record<
  string,
  { bn: string; en: string; tone: "amber" | "blue" | "green" | "red" | "grey" }
> = {
  payment_due: { bn: "ফি পরিশোধ বাকি", en: "Fee due", tone: "amber" },
  in_review: { bn: "অফিসে যাচাই চলছে", en: "Being reviewed", tone: "blue" },
  hearing: { bn: "শুনানি নির্ধারিত", en: "Hearing scheduled", tone: "blue" },
  final_payment_due: { bn: "অনুমোদিত — শেষ ফি বাকি", en: "Approved — final fee due", tone: "amber" },
  completed: { bn: "সম্পন্ন — ডকুমেন্ট প্রস্তুত", en: "Done — document ready", tone: "green" },
  rejected: { bn: "নামঞ্জুর", en: "Rejected", tone: "red" },
  cancelled: { bn: "বাতিল", en: "Cancelled", tone: "grey" },
};

/** Status label for a type (its own wording if it has one). */
export function statusLabel(status: string, type?: string) {
  const base = STATUS_LABEL[status] ?? { bn: status, en: status, tone: "grey" as const };
  const own = type ? APPLICATION_TYPES[type as ApplicationTypeId]?.labels?.[status as AppStatus] : undefined; // prettier-ignore
  return own ? { ...base, ...own } : base;
}

// ---------- what an application is about ----------

export const COMPLAINT_CATEGORIES = [
  "extra_money",
  "broker",
  "delay",
  "wrong_record",
  "technical",
  "other",
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ComplaintCategory, { bn: string; en: string }> = {
  extra_money: { bn: "সরকারি ফির বেশি টাকা / ঘুষ চাওয়া", en: "Asked for more than the official fee / a bribe" }, // prettier-ignore
  broker: { bn: "দালালের হয়রানি", en: "Harassed by a broker" },
  delay: { bn: "সময়সীমা পেরিয়ে দেরি", en: "Delay past the deadline" },
  wrong_record: { bn: "রেকর্ডে ভুল", en: "Wrong record" },
  technical: { bn: "অনলাইন সেবায় কারিগরি সমস্যা", en: "Technical problem with an online service" },
  other: { bn: "অন্যান্য", en: "Other" },
};

/** Everything an application may store about itself (each type uses its own fields). */
export interface AppDetails {
  mouza?: string;
  mouza_bn?: string;
  mouza_en?: string;
  dag_no?: number | null;
  // certified copy
  survey?: Survey;
  delivery?: "online" | "post";
  // mutation
  deed_no?: string;
  deed_id?: number;
  case_no?: string | null;
  area_dec?: number;
  seller_bn?: string;
  seller_en?: string;
  buyer_bn?: string;
  buyer_en?: string;
  new_khatian_no?: number;
  // land tax
  owner_id?: number;
  holder_bn?: string;
  holder_en?: string;
  share_dec?: number;
  years_due?: string[];
  due_tk?: number;
  through_fy?: string;
  exempt?: boolean;
  basis_bn?: string;
  basis_en?: string;
  // complaint
  category?: ComplaintCategory;
  text?: string;
  anonymous?: boolean;
  urgent?: boolean;
  amount_tk?: number | null;
  service?: string | null;
}

const bnd = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
const SURVEY_BN: Record<Survey, string> = { CS: "সিএস", SA: "এসএ", RS: "আরএস", BS: "বিএস" };

/** One line saying what an application is about, in both languages. */
export function summarize(type: string, d: AppDetails): { bn: string; en: string } {
  const place =
    d.mouza_bn && d.dag_no != null
      ? {
          bn: `${d.mouza_bn} মৌজা, দাগ ${bnd(d.dag_no)}`,
          en: `${d.mouza_en} mouza, dag ${d.dag_no}`,
        }
      : null;
  if (type === "certified_copy" && place && d.survey) {
    return {
      bn: `${place.bn} · ${SURVEY_BN[d.survey]} খতিয়ান · ${d.delivery === "post" ? "ডাকযোগে" : "অনলাইনে"}`,
      en: `${place.en} · ${d.survey} khatian · ${d.delivery === "post" ? "by post" : "online"}`,
    };
  }
  if (type === "mutation" && place) {
    return {
      bn: `দলিল ${bnd(d.deed_no ?? "")}: ${d.seller_bn} → ${d.buyer_bn}, ${bnd(d.area_dec ?? 0)} শতক · ${place.bn}`,
      en: `Deed ${d.deed_no}: ${d.seller_en} → ${d.buyer_en}, ${d.area_dec} dec · ${place.en}`,
    };
  }
  if (type === "land_tax" && place) {
    const years = d.years_due ?? [];
    return {
      bn: `${d.holder_bn} · ${place.bn} · ${years.length ? `${bnd(years.length)} অর্থবছর` : "বকেয়া নেই"}`,
      en: `${d.holder_en} · ${place.en} · ${years.length ? `${years.length} fiscal year(s)` : "nothing due"}`,
    };
  }
  if (type === "complaint" && d.category) {
    const c = CATEGORY_LABEL[d.category];
    return {
      bn: `${c.bn}${place ? ` · ${place.bn}` : ""}${d.amount_tk ? ` · ${bnd(d.amount_tk)} টাকা` : ""}`,
      en: `${c.en}${place ? ` · ${place.en}` : ""}${d.amount_tk ? ` · Tk ${d.amount_tk}` : ""}`,
    };
  }
  return place ?? { bn: "", en: "" };
}

/** How many of a type's steps are done in a status. */
export function progressOf(type: string, status: string): number {
  return APPLICATION_TYPES[type as ApplicationTypeId]?.progress[status as AppStatus] ?? 1;
}
