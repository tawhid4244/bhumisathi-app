import { normalizeTranscript } from "../ai/bn-numbers";
import { findDagNumber } from "../ai/intent";
import { CATEGORY_LABEL, COMPLAINT_CATEGORIES, type ComplaintCategory } from "../services/catalog";
import { getSql } from "../sql";

// Complaints (কারিগরি সহায়তা ও অভিযোগ): categories, a quick rule-based triage of the citizen's own
// words, and public monthly statistics. In the chat, Sathi AI picks the category; on the form,
// triage suggests it. Either way the officer sees the category, urgency and any dag or amount.

export { CATEGORY_LABEL, COMPLAINT_CATEGORIES, type ComplaintCategory };

/** Money demands are urgent (3 days); everything else gets 7 days. */
export const URGENT: ComplaintCategory[] = ["extra_money", "broker"];
export const slaDays = (c: ComplaintCategory) => (URGENT.includes(c) ? 3 : 7);

const RULES: [RegExp, ComplaintCategory][] = [
  [/দালাল|broker|middleman/i, "broker"],
  [/ঘুষ|বাড়তি|অতিরিক্ত টাকা|বেশি টাকা|টাকা চে(য়|য়)ে|টাকা দাবি|bribe|extra money|asked for (more )?money/i, "extra_money"],
  [/দেরি|দেরী|মাস ধরে|ঘুরাচ্ছে|সময় পেরিয়ে|delay|late|waiting for months/i, "delay"],
  [/ভুল|রেকর্ডে নাম নেই|wrong|mistake|incorrect/i, "wrong_record"],
  [/সাইট|ওয়েবসাইট|লগইন|সার্ভার|কাজ করছে না|error|login|website|server|not working/i, "technical"],
]; // prettier-ignore

export interface Triage {
  category: ComplaintCategory;
  urgent: boolean;
  dag_no: number | null;
  amount_tk: number | null;
  /** Mutation, tax, registry … if the text names one. */
  service: "mutation" | "land_tax" | "registry" | "survey" | null;
}

/** Rule-based triage of a complaint text (Bangla or English, digits or number words). */
export function triageComplaint(raw: string): Triage {
  const text = normalizeTranscript(raw).normalize("NFC");
  const hit = RULES.find(([re]) => re.test(text));
  // A broker who asks for money is still a broker complaint (the officer acts on the broker).
  const category: ComplaintCategory = hit?.[1] ?? "other";
  const money = /(\d[\d,]*(?:\.\d+)?)\s*(টাকা|tk|taka|৳)/i.exec(text) ?? /(?:৳|tk\.?)\s*(\d[\d,]*)/i.exec(text); // prettier-ignore
  const service = /নামজারি|মিউটেশন|খারিজ|mutation|namjari/i.test(text)
    ? "mutation"
    : /খাজনা|ভূমি উন্নয়ন কর|দাখিলা|land tax|dakhila/i.test(text)
      ? "land_tax"
      : /রেজিস্ট্রি|সাব-রেজিস্ট্রি|দলিল|registry|deed/i.test(text)
        ? "registry"
        : /জরিপ|আমিন|survey|amin/i.test(text)
          ? "survey"
          : null;
  return {
    category,
    urgent: URGENT.includes(category),
    dag_no: findDagNumber(text),
    amount_tk: money ? Number(money[1]!.replace(/,/g, "")) : null,
    service,
  };
}

export interface ComplaintStats {
  month: string;
  total: number;
  resolved: number;
  open: number;
  by_category: { category: ComplaintCategory; bn: string; en: string; n: number }[];
  /** Resolved within the deadline, as a share of the resolved ones (null when none resolved). */
  on_time_pct: number | null;
}

/** Public statistics for the current month (counts only — no names, no texts). */
export async function complaintStats(): Promise<ComplaintStats> {
  const sql = getSql();
  const rows = await sql<{ category: ComplaintCategory; status: string; on_time: boolean | null }[]>`
    select details->>'category' as category, status,
           case when status = 'completed' then updated_at::date <= due_on end as on_time
    from applications
    where type = 'complaint'
      and date_trunc('month', submitted_at at time zone 'Asia/Dhaka') = date_trunc('month', now() at time zone 'Asia/Dhaka')`; // prettier-ignore
  const [{ month }] = (await sql`select to_char(bd_today(), 'YYYY-MM') as month`) as unknown as [{ month: string }]; // prettier-ignore
  const resolved = rows.filter((r) => r.status === "completed");
  return {
    month,
    total: rows.length,
    resolved: resolved.length,
    open: rows.filter((r) => r.status === "in_review").length,
    by_category: COMPLAINT_CATEGORIES.map((c) => ({ category: c, ...CATEGORY_LABEL[c], n: rows.filter((r) => r.category === c).length })), // prettier-ignore
    on_time_pct: resolved.length ? Math.round((100 * resolved.filter((r) => r.on_time).length) / resolved.length) : null, // prettier-ignore
  };
}
