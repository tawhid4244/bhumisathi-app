import { readFile } from "node:fs/promises";
import path from "node:path";
import { saveUpload } from "../adapters/storage";
import { runAgent } from "../ai/agent";
import { describeWithNames } from "../ai/describe";
import { knownNames } from "../ai/pii";
import { getProvider } from "../ai/provider";
import type { SessionUser } from "../auth/roles";
import { runTool, SYSTEM } from "../tools/registry";
import { getSql } from "../sql";
import { seed } from "../../scripts/seed";
import { OWNER } from "../../scripts/seed-data";

// Judge mode: a ~3-minute guided tour G1 → G3 → G8 → G2 → G7 on the synthetic world.
//
// Security: the browser only sends a step NUMBER. Every action below is fixed in this file
// (fixed dags, people and areas), so judge mode cannot be used to do anything else, and the
// visitor never receives an officer or admin session. Write steps run as a scripted
// "demo officer" and are recorded in the audit log like any other write.

const DEMO_OFFICER: SessionUser = {
  id: "00000000-0000-4000-8000-000000000d09", // not a real account: cannot log in
  email: "judge-mode@demo.bhumisathi.test",
  name_bn: "জাজ মোড (স্বয়ংক্রিয় কর্মকর্তা)",
  role: "officer",
};

export interface JudgeCard {
  scenario: "শুরু" | "G1" | "G3" | "G8" | "G2" | "G7";
  title_bn: string;
  caption_bn: string;
  caption_en: string;
  verdict?: "red" | "amber" | "green";
  lines: string[];
  link?: { href: string; label_bn: string };
  qr_svg?: string;
}

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
const N145 = { mouza: "Nayapara", dag_no: 145 };
const N141 = { mouza: "Nayapara", dag_no: 141 };
const ANWAR = 20; // holder of dag 141

type Register = { ok: boolean; ref?: string; reason_bn?: string; mutation_case?: string | null };
type Report = { verdict: "red" | "amber" | "green"; verdict_bn: string; reasons: { bn: string }[] };
type Verify = { overall: "red" | "amber" | "green"; overall_bn: string; lights: Record<string, { ok: boolean; bn: string }> }; // prettier-ignore

/** State carried between steps (the seal code for G7). Kept per server instance. */
let lastSealCode: string | null = null;

const officer = { user: DEMO_OFFICER };
const visitor = { user: null };

export const JUDGE_STEPS: ((sql: ReturnType<typeof getSql>) => Promise<JudgeCard>)[] = [
  // 0. Reset
  async (sql) => {
    await seed(sql);
    lastSealCode = null;
    return {
      scenario: "শুরু",
      title_bn: "ডেমো নতুন করে শুরু",
      caption_bn: "সব তথ্য কাল্পনিক। নয়াপাড়া মৌজার দাগ ১৪৫: রহিম উদ্দিনের ২০ শতক, কোনো দায় নেই।",
      caption_en: "Fresh synthetic world. Dag 145: Rahim holds 20 decimals, no locks.",
      lines: [],
    };
  },
  // G1 step 1: baina
  async () => {
    const r = (await runTool("register_baina", { ...N145, seller_id: OWNER.RAHIM, buyer_id: OWNER.SALMA, area_dec: 10, days: 90 }, officer)) as Register; // prettier-ignore
    return {
      scenario: "G1",
      title_bn: "বায়না নিবন্ধন",
      caption_bn: `রহিম ১০ শতক সালমা আক্তারের কাছে বায়না দিলেন (${r.ref ?? ""})। লেজারে ওই ১০ শতক আটকে গেল।`,
      caption_en: "Baina of 10 decimals to Salma: those 10 decimals are now reserved.",
      verdict: r.ok ? "green" : "red",
      lines: [r.ok ? `বায়না নম্বর ${r.ref}` : (r.reason_bn ?? "")],
    };
  },
  // G1 step 2: double sale blocked
  async () => {
    const r = (await runTool("register_sale", { ...N145, seller_id: OWNER.RAHIM, buyer_id: OWNER.JAMAL, area_dec: 15 }, officer)) as Register; // prettier-ignore
    return {
      scenario: "G1",
      title_bn: "একই জমি দুইবার বিক্রি — আটকে গেল",
      caption_bn:
        "এখন রহিম জামাল মিয়ার কাছে ১৫ শতক বিক্রি করতে চাইলেন। বিক্রয়যোগ্য মাত্র ১০ শতক — দলিল আটকে গেল, সালমাকে এসএমএস গেল।",
      caption_en: "Selling 15 decimals to Jamal is blocked: only 10 are sellable.",
      verdict: r.ok ? "green" : "red",
      lines: [r.reason_bn ?? "নিবন্ধিত"],
      link: { href: "/check?mouza=Nayapara&by=dag&no=145", label_bn: "জমি যাচাই রিপোর্ট দেখুন" },
    };
  },
  // G1 step 3: the honest sale
  async () => {
    const r = (await runTool("register_sale", { ...N145, seller_id: OWNER.RAHIM, buyer_id: OWNER.JAMAL, area_dec: 10 }, officer)) as Register; // prettier-ignore
    return {
      scenario: "G1",
      title_bn: "বৈধ বিক্রি",
      caption_bn: "বাকি ১০ শতক বিক্রি বৈধ — দলিল নিবন্ধিত, নামজারি মামলা নিজে থেকেই খুলে গেল।",
      caption_en: "The remaining 10 decimals sell; a mutation case opens automatically.",
      verdict: r.ok ? "green" : "red",
      lines: [r.ok ? `দলিল ${r.ref} · নামজারি ${r.mutation_case ?? ""}` : (r.reason_bn ?? "")],
    };
  },
  // G3: deed reader
  async () => {
    const buf = await readFile(path.join(process.cwd(), "content/deeds/deed-4512.png"));
    const { id } = await saveUpload(buf);
    const r = (await runTool("deed_read", { upload_id: id }, SYSTEM)) as {
      summary_bn: string;
      verdict: "red" | "amber" | "green";
      findings: { bn: string }[];
    };
    return {
      scenario: "G3",
      title_bn: "দলিল পড়া",
      caption_bn:
        "দলিল ৪৫১২/২০২৪-এর ছবি থেকে সাথী সহজ বাংলায় সারাংশ দিল এবং রেকর্ডের সাথে মিলিয়ে দেখল: খতিয়ানে ম্যাপের চেয়ে ৩ শতক বেশি — আমিন দিয়ে সীমানা যাচাই করুন।",
      caption_en: "Deed photo → plain Bangla → the khatian shows 3 decimals more than the map.",
      verdict: r.verdict,
      lines: [r.summary_bn, ...r.findings.map((f) => f.bn)].slice(0, 4),
      link: { href: "/deed", label_bn: "নিজে দলিল পড়ুন" },
    };
  },
  // G8: Sathi AI
  async () => {
    const question = "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও";
    const res = await runAgent({
      messages: [{ role: "user", content: question }],
      provider: getProvider(),
      context: visitor, // the model only gets the public tools
      describe: describeWithNames,
      knownNames: await knownNames(),
    });
    const check = res.toolCalls.find((c) => c.name === "jomi_check" && c.ok)?.output as Report | undefined; // prettier-ignore
    return {
      scenario: "G8",
      title_bn: "সাথী এআই — বাংলায় প্রশ্ন",
      caption_bn: `নাগরিক জিজ্ঞাসা করলেন: “${question}”। সাথী নিজে যাচাই টুল চালিয়ে উত্তর দিল: একটু আগের বায়না ও বিক্রির পরে দাগ ১৪৫-এ আর বিক্রয়যোগ্য জমি নেই — কেনা নিরাপদ নয়।`,
      caption_en:
        "A Bangla question (typed or spoken): Sathi runs the same check; after G1 nothing is left to sell.",
      verdict: check?.verdict,
      lines: [res.reply.slice(0, 400)],
      link: { href: `/chat?q=${encodeURIComponent(question)}`, label_bn: "নিজে জিজ্ঞাসা করুন" },
    };
  },
  // G2: inheritance
  async () => {
    const r = (await runTool(
      "warish_compute",
      { family: { wives: 1, sons: 2, daughters: 1 }, deceased_owner_id: OWNER.ABDUL_KARIM },
      visitor,
    )) as {
      // prettier-ignore
      shares: { label_bn: string; fraction: string; per_dag: { dag_no: number; decimals: number }[] }[];
    };
    return {
      scenario: "G2",
      title_bn: "ওয়ারিশ হিসাব",
      caption_bn:
        "আব্দুল করিম মারা গেছেন। ফারায়েজ অনুযায়ী স্ত্রী, দুই ছেলে ও মেয়ের অংশ — প্রতিটি দাগে কত শতক।",
      caption_en: "Faraid shares for the wife, two sons and a daughter, per dag.",
      verdict: "green",
      lines: r.shares.map(
        (s) =>
          `${s.label_bn} (${bn(s.fraction)}): ${s.per_dag.map((p) => `দাগ ${bn(p.dag_no)} — ${bn(p.decimals)} শতক`).join(", ")}`,
      ),
      link: { href: `/warish?owner=${OWNER.ABDUL_KARIM}`, label_bn: "ওয়ারিশ হিসাব খুলুন" },
    };
  },
  // G7 step 1: seal + verify
  async () => {
    const s = (await runTool("seal_issue", N141, SYSTEM)) as { code: string; qr_svg: string };
    lastSealCode = s.code;
    const v = (await runTool("seal_verify", { code: s.code }, visitor)) as Verify;
    return {
      scenario: "G7",
      title_bn: "সিলযুক্ত রিপোর্ট",
      caption_bn:
        "দাগ ১৪১-এর রিপোর্টে ডিজিটাল স্বাক্ষর (Ed25519) ও QR। ব্যাংক স্ক্যান করলে চারটি বাতি জ্বলে: আসল, হালনাগাদ, অক্ষত, অংশের যোগফল মেলে।",
      caption_en: "Signed report for dag 141: scan the QR → four green lights.",
      verdict: v.overall,
      lines: [v.overall_bn, ...Object.values(v.lights).map((l) => `${l.ok ? "✓" : "✗"} ${l.bn}`)],
      qr_svg: s.qr_svg,
      link: { href: `/verify#${s.code}`, label_bn: "যাচাই পাতা খুলুন" },
    };
  },
  // G7 step 2: superseded after a new baina
  async () => {
    if (!lastSealCode) lastSealCode = ((await runTool("seal_issue", N141, SYSTEM)) as { code: string }).code; // prettier-ignore
    await runTool("register_baina", { ...N141, seller_id: ANWAR, buyer_id: OWNER.SALMA, area_dec: 2, days: 30 }, officer); // prettier-ignore
    const v = (await runTool("seal_verify", { code: lastSealCode }, visitor)) as Verify;
    return {
      scenario: "G7",
      title_bn: "পুরনো রিপোর্ট ধরা পড়ল",
      caption_bn:
        "রিপোর্টের পরে দাগ ১৪১-এ নতুন বায়না হলো। একই QR আবার স্ক্যান: আসল, কিন্তু পুরনো — হলুদ। এক জমি, এক সত্য।",
      caption_en: "After a new baina the same QR shows GENUINE but SUPERSEDED (amber).",
      verdict: v.overall,
      lines: [v.overall_bn, ...Object.values(v.lights).map((l) => `${l.ok ? "✓" : "✗"} ${l.bn}`)],
      link: { href: `/verify#${lastSealCode}`, label_bn: "যাচাই পাতা খুলুন" },
    };
  },
];

export async function runJudgeStep(step: number): Promise<JudgeCard> {
  const fn = JUDGE_STEPS[step];
  if (!fn) throw new RangeError("No such judge step.");
  return fn(getSql());
}
