import type Anthropic from "@anthropic-ai/sdk";
import { unwrapDocument } from "./documents";
import { bn } from "../engines/rules";
import { westernDigits } from "../engines/ledger";
import type { AgentMessage, AgentResponse, ChatRequest, ModelProvider } from "./provider";

// A tiny rule-based stand-in for the AI model, used by browser tests and offline demos
// (AI_PROVIDER=mock). It follows the same tool protocol as the real model, so the whole app —
// tools, confirmation card, sources, badges — runs for real; only the "thinking" is scripted.

type Block = Anthropic.Beta.BetaContentBlock;

let counter = 0;
const id = () => `mock_${Date.now().toString(36)}_${counter++}`;
const text = (t: string): Block => ({ type: "text", text: t, citations: null }) as Block;
const call = (name: string, input: unknown): Block =>
  ({ type: "tool_use", id: id(), name, input, caller: { type: "direct" } }) as unknown as Block;

function lastUserText(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

/** Tool results in the last message, by tool name. */
function lastResults(messages: AgentMessage[]): Map<string, { data: unknown; error: boolean }> {
  const out = new Map<string, { data: unknown; error: boolean }>();
  const last = messages.at(-1);
  if (!last || last.role !== "user" || !Array.isArray(last.content)) return out;
  const names = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.content)) {
      for (const b of m.content) if (b.type === "tool_use") names.set(b.id, b.name);
    }
  }
  for (const b of last.content) {
    if (b.type !== "tool_result") continue;
    const raw = unwrapDocument(typeof b.content === "string" ? b.content : "");
    let data: unknown = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      /* plain text */
    }
    out.set(names.get(b.tool_use_id) ?? "?", { data, error: Boolean(b.is_error) });
  }
  return out;
}

const firstNumber = (s: string) => {
  const m = /\d+(\.\d+)?/.exec(westernDigits(s));
  return m ? Number(m[0]) : null;
};

function respond(req: ChatRequest): { content: Block[]; stop_reason: string } {
  const q = lastUserText(req.messages);
  const english = /[a-z]{3}/i.test(q) && !/[ঀ-৿]/.test(q);
  const results = lastResults(req.messages);

  // --- follow-ups after tool results ---
  const found = results.get("find_dag");
  if (found && Array.isArray(found.data) && found.data.length === 1) {
    const m = found.data[0] as { mouza_en: string; dag_no: number };
    // "মাপ কত?" → measure on the map; otherwise check the land.
    const tool = /মাপ|আয়তন|area|size|measure/i.test(q) ? "map_area" : "jomi_check";
    return {
      content: [call(tool, { mouza: m.mouza_en, dag_no: m.dag_no })],
      stop_reason: "tool_use",
    };
  }
  const deed = results.get("deed_read");
  if (deed && !deed.error) {
    const d = deed.data as {
      verdict: string;
      summary_bn: string;
      findings: { severity: string; bn: string }[];
    };
    const label = d.verdict === "red" ? "লাল" : d.verdict === "amber" ? "হলুদ" : "সবুজ";
    const top = d.findings.filter((f) => f.severity !== "info").map((f) => `- ${f.bn}`);
    const lines = [d.summary_bn, `রেকর্ডের সাথে মিলিয়ে ফলাফল: ${label}।`, ...top];
    return { content: [text(lines.join("\n"))], stop_reason: "end_turn" };
  }
  const measured = results.get("map_area");
  if (measured && !measured.error) {
    const a = measured.data as {
      dag_no: number;
      map_area_dec: number;
      recorded_area_dec: number;
      matches_khatian: boolean;
    };
    const verdict = a.matches_khatian ? "মিলেছে" : "অমিল, আমিন দিয়ে যাচাই করুন";
    return {
      content: [
        text(
          `দাগ ${bn(a.dag_no)}-এর মাপ মৌজা ম্যাপ অনুযায়ী প্রায় ${bn(a.map_area_dec)} শতক; খতিয়ানে ${bn(a.recorded_area_dec)} শতক — ${verdict}। এটি আনুমানিক মাপ, জরিপ নয়।`,
        ),
      ],
      stop_reason: "end_turn",
    };
  }
  const check = results.get("jomi_check");
  if (check && !check.error) {
    const r = check.data as {
      verdict_bn: string;
      verdict_en: string;
      reasons: { bn: string; en: string }[];
      dag: { mouza_bn: string; dag_no: number };
    };
    const reason = r.reasons[0];
    return {
      content: [
        text(
          english
            ? `Result: ${r.verdict_en}. ${reason?.en ?? ""} This is a risk check on records, not a legal ruling.`
            : `ফলাফল: ${r.verdict_bn} (${r.dag.mouza_bn} দাগ ${bn(r.dag.dag_no)})। ${reason?.bn ?? ""} এটি রেকর্ডের ঝুঁকি যাচাই, আইনি রায় নয়।`,
        ),
      ],
      stop_reason: "end_turn",
    };
  }
  const laws = results.get("law_search");
  if (laws) {
    const hits = (laws.data as { law_bn: string; section: string; excerpt: string }[]) ?? [];
    if (hits.length === 0) {
      return { content: [text("আমি নিশ্চিত নই, অনুগ্রহ করে এসি ল্যান্ড অফিসে জিজ্ঞাসা করুন। প্রয়োজনে ১৬১২২ নম্বরে কল করুন।")], stop_reason: "end_turn" }; // prettier-ignore
    }
    const fee = hits[0]!.excerpt.includes("১,১৭০")
      ? "নামজারির সরকারি ফি মোট ১,১৭০ টাকা (২০ + ৫০ + ১,০০০ + ১০০)। "
      : "";
    const cite = hits
      .map((h) => (/^\d/.test(h.section) ? `${h.law_bn}, ধারা ${bn(h.section)}` : h.law_bn))
      .join("; ");
    return {
      content: [text(`${fee}বিস্তারিত নিচের সূত্রে দেখুন।\nসূত্র: ${cite}`)],
      stop_reason: "end_turn",
    };
  }
  for (const name of ["register_baina", "register_sale", "register_lien"]) {
    const r = results.get(name);
    if (!r) continue;
    if (typeof r.data === "string") {
      return { content: [text("ঠিক আছে, কিছু নিবন্ধন করা হয়নি।")], stop_reason: "end_turn" };
    }
    const d = r.data as { ok: boolean; ref?: string; reason_bn?: string };
    return {
      content: [text(d.ok ? `নিবন্ধিত হয়েছে: ${d.ref}।` : `নিবন্ধন আটকানো হয়েছে: ${d.reason_bn}`)],
      stop_reason: "end_turn",
    };
  }

  const filed = results.get("complaint_submit");
  if (filed) {
    if (typeof filed.data === "string") {
      return { content: [text(english ? "All right, nothing was filed." : "ঠিক আছে, কোনো অভিযোগ দাখিল করা হয়নি।")], stop_reason: "end_turn" }; // prettier-ignore
    }
    const d = filed.data as { app_no: string };
    return {
      content: [text(english ? `Your complaint ${d.app_no} has been filed. The office must act within 3 days; follow it under My services.` : `আপনার অভিযোগ ${d.app_no} দাখিল হয়েছে। অফিসকে ৩ দিনের মধ্যে ব্যবস্থা নিতে হবে; ‘আমার সেবা’-তে অবস্থা দেখুন।`)], // prettier-ignore
      stop_reason: "end_turn",
    };
  }
  const tax = results.get("land_tax_due");
  if (tax && !tax.error) {
    const d = tax.data as { linked: boolean; reports: { mouza_bn: string; dag_no: number; holders: { name_bn: string; years_due: string[]; due_tk: number; exempt: boolean }[] }[] }; // prettier-ignore
    if (!d.linked) return { content: [text("আপনার অ্যাকাউন্টের সাথে কোনো জমি যুক্ত নেই। কোন দাগের খাজনা জানতে চান?")], stop_reason: "end_turn" }; // prettier-ignore
    const lines = d.reports.flatMap((r) =>
      r.holders.map((h) =>
        h.years_due.length === 0
          ? `${r.mouza_bn} দাগ ${bn(r.dag_no)}: কোনো বকেয়া নেই।`
          : `${r.mouza_bn} দাগ ${bn(r.dag_no)}: ${bn(h.years_due.length)} অর্থবছর বাকি, ${h.exempt ? "করমুক্ত (৳০)" : `৳${bn(h.due_tk)}`}।`,
      ),
    );
    return { content: [text(`${lines.join("\n")}\n/land-tax পাতায় দাখিলা নিন।`)], stop_reason: "end_turn" }; // prettier-ignore
  }
  const status = results.get("application_status");
  if (status && !status.error) {
    const d = status.data as { applications: { app_no: string; summary_bn: string; status: string }[] }; // prettier-ignore
    if (d.applications.length === 0) return { content: [text("আপনার কোনো আবেদন নেই।")], stop_reason: "end_turn" }; // prettier-ignore
    const a = d.applications[0]!;
    return { content: [text(`সর্বশেষ আবেদন ${a.app_no} (${a.summary_bn}): অবস্থা ${a.status}।`)], stop_reason: "end_turn" }; // prettier-ignore
  }

  // --- a new question ---
  // A complaint: "মিউটেশনে দালাল ৫,০০০ টাকা চেয়েছে" → propose filing it (the citizen confirms).
  if (/দালাল|ঘুষ|বাড়তি টাকা|অতিরিক্ত টাকা|টাকা চেয়েছে|অভিযোগ|broker|bribe|complain/i.test(q)) {
    return {
      content: [
        text(english ? "I can file this complaint for you. Please check it:" : "আমি অভিযোগটি দাখিল করতে পারি। মিলিয়ে দেখুন:"), // prettier-ignore
        call("complaint_submit", { text: q, category: /দালাল|broker/i.test(q) ? "broker" : "extra_money" }), // prettier-ignore
      ],
      stop_reason: "tool_use",
    };
  }
  if (/খাজনা|ভূমি উন্নয়ন কর|land tax/i.test(q)) {
    const n = firstNumber(q);
    return { content: [call("land_tax_due", n ? { dag_no: n } : {})], stop_reason: "tool_use" };
  }
  if (/আমার আবেদন|আবেদন কোথায়|নামজারি কোথায়|my application/i.test(q)) {
    return { content: [call("application_status", {})], stop_reason: "tool_use" };
  }
  // A deed photo attached in the chat: "(upload_id: …)".
  const upload = /upload_id:\s*([a-f0-9]{24})/.exec(q);
  if (upload) {
    return { content: [call("deed_read", { upload_id: upload[1] })], stop_reason: "tool_use" };
  }
  const dag = firstNumber(q);
  if (/বায়না|baina/i.test(q) && dag) {
    // Demo phrase: "রহিমের ১৪৫ নম্বর দাগে সালমার নামে ১০ শতক বায়না"
    const nums =
      westernDigits(q)
        .match(/\d+(\.\d+)?/g)
        ?.map(Number) ?? [];
    return {
      content: [
        text("নিচের তথ্যগুলো মিলিয়ে নিশ্চিত করুন।"),
        call("register_baina", { mouza: "Nayapara", dag_no: nums[0], seller_id: 1, buyer_id: 3, area_dec: nums[1] ?? 10, days: 90 }), // prettier-ignore
      ],
      stop_reason: "tool_use",
    };
  }
  if (dag && /দাগ|dag|plot/i.test(q)) {
    return { content: [call("find_dag", { dag_no: dag })], stop_reason: "tool_use" };
  }
  if (/নামজারি|মিউটেশন|খরচ|ফি|বায়না|ওয়ারিশ|মামলা|দখল|আইন|mutation|fee|law/i.test(q)) {
    return { content: [call("law_search", { query: q })], stop_reason: "tool_use" };
  }
  return {
    content: [
      text("আমি নিশ্চিত নই, অনুগ্রহ করে এসি ল্যান্ড অফিসে জিজ্ঞাসা করুন। প্রয়োজনে ১৬১২২ নম্বরে কল করুন।"),
    ],
    stop_reason: "end_turn",
  };
}

export class MockProvider implements ModelProvider {
  readonly model = "mock";
  async send(req: ChatRequest, onText?: (delta: string) => void): Promise<AgentResponse> {
    const { content, stop_reason } = respond(req);
    if (onText) for (const b of content) if (b.type === "text") onText(b.text);
    return {
      id: id(),
      type: "message",
      role: "assistant",
      model: this.model,
      content,
      stop_reason,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    } as unknown as AgentResponse;
  }
}
