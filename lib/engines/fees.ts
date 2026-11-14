import fees from "../../content/fees.json";

// Fee and time guide, read from content/fees.json (data, not code): every line has a source and
// a note on how it was verified, so the citizen knows what is official and what to confirm.

export interface FeeItem {
  bn: string;
  en: string;
  tk: number;
  when_bn: string;
}

export interface FeeService {
  id: string;
  bn: string;
  en: string;
  items: FeeItem[];
  total_tk: number | null;
  components_bn?: string[];
  time_bn: string;
  law_id?: string;
  source: string;
  verified: string;
}

export const FEE_NOTE: string = fees.note;

export function listFees(): FeeService[] {
  return (fees.services as Omit<FeeService, "total_tk">[]).map((s) => ({
    ...s,
    total_tk: s.items.length ? s.items.reduce((t, i) => t + i.tk, 0) : null,
  }));
}

const ALIASES: Record<string, string[]> = {
  mutation: ["mutation", "namjari", "নামজারি", "মিউটেশন", "খারিজ", "জমাখারিজ"],
  certified_khatian: ["certified", "সার্টিফাইড", "নকল", "পর্চা"],
  online_khatian: ["online khatian", "অনলাইন খতিয়ান", "খতিয়ান", "khatian", "porcha"],
  mouza_map: ["map", "ম্যাপ", "নকশা"],
  registration: ["registration", "রেজিস্ট্রি", "রেজিস্ট্রেশন", "দলিল", "deed", "stamp", "স্ট্যাম্প"],
  helpline: ["16122", "১৬১২২", "helpline", "হেল্পলাইন", "complaint", "অভিযোগ"],
};

/** Find a service by id or by a word people use for it ("নামজারি", "খারিজ", "deed"…). */
export function feeGuide(service: string): FeeService | null {
  const q = service.trim().toLowerCase();
  const all = listFees();
  const byId = all.find((s) => s.id === q);
  if (byId) return byId;
  for (const [id, words] of Object.entries(ALIASES)) {
    if (words.some((w) => q.includes(w.toLowerCase()))) return all.find((s) => s.id === id) ?? null;
  }
  return null;
}
