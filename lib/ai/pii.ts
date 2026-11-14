// Personal data never goes to the AI model.
//
// Before every model request, a COPY of the conversation is masked:
//   NID numbers   → [NID-১], [NID-২] …   (synthetic SYN-0000-0001 and real-looking 10/13/17 digits)
//   phone numbers → [ফোন-১] …            (+880…, 01XXXXXXXXX, +880-SYN-0001)
//   known names   → [ব্যক্তি-১] …        (owners in the records; Bangla and English spellings)
// The model answers with the placeholders; the agent puts the real values back before the
// citizen sees the answer. The same value always gets the same placeholder within a
// conversation, because the mask is rebuilt from the start of the history every turn.

const BN = "০১২৩৪৫৬৭৮৯";
const bnNum = (n: number) => String(n).replace(/\d/g, (d) => BN[Number(d)]!);

// Digits may be Bangla or English. One combined pattern, so placeholders are numbered in the
// order values appear. Digit boundaries stop a phone pattern matching inside a longer number.
const D = "[0-9০-৯]";
const PII = new RegExp(
  [
    String.raw`(?<synNid>SYN-\d{4}-\d{4})`,
    String.raw`(?<synPhone>\+880-SYN-\d{4})`,
    // Bangladeshi mobile: 01[3-9] + 8 digits, optional +88 / 88 and separators.
    String.raw`(?<phone>(?<![0-9০-৯+])(?:\+?(?:88|৮৮)[-\s]?)?[0০][1১][3-9৩-৯]${D}{2}[-\s]?${D}{3}[-\s]?${D}{3}(?![0-9০-৯]))`,
    // NID: 10, 13 or 17 digits (old, new, smart card).
    String.raw`(?<nid>(?<![0-9০-৯])(?:${D}{17}|${D}{13}|${D}{10})(?![0-9০-৯]))`,
  ].join("|"),
  "gu",
);

export interface Masker {
  /** Replace personal data in a text with placeholders. */
  mask(text: string): string;
  /** Put the real values back. */
  unmask(text: string): string;
  /** How many distinct values were masked (for tests and logs). */
  readonly size: number;
}

/**
 * @param knownNames people to hide. A group (string[]) lists ONE person's spellings
 *   (e.g. ["মোঃ রহিম উদ্দিন", "রহিম উদ্দিন", "Md. Rahim Uddin"]): all get the same placeholder,
 *   and unmask returns the first spelling. A plain string is a group of one.
 */
export function createMasker(knownNames: (string | string[])[] = []): Masker {
  const toPlaceholder = new Map<string, string>();
  const toValue = new Map<string, string>();
  const counters: Record<string, number> = {};
  // Every spelling → the person's main spelling.
  const canonical = new Map<string, string>();
  for (const entry of knownNames) {
    const group = (Array.isArray(entry) ? entry : [entry]).map((n) => n.trim()).filter((n) => n.length >= 3); // prettier-ignore
    for (const alias of group) if (!canonical.has(alias)) canonical.set(alias, group[0]!);
  }
  // Longest spellings first so "মোঃ রহিম উদ্দিন" wins over "রহিম উদ্দিন".
  const names = [...canonical.keys()].sort((a, b) => b.length - a.length);

  const placeholder = (kind: string, value: string) => {
    const key = `${kind}|${value}`;
    let p = toPlaceholder.get(key);
    if (!p) {
      counters[kind] = (counters[kind] ?? 0) + 1;
      p = `[${kind}-${bnNum(counters[kind]!)}]`;
      toPlaceholder.set(key, p);
      toValue.set(p, value);
    }
    return p;
  };

  return {
    mask(text) {
      let out = text.replace(PII, (m, ...args) => {
        const g = args.at(-1) as Record<string, string | undefined>;
        return placeholder(g.synPhone || g.phone ? "ফোন" : "NID", m);
      });
      for (const name of names) {
        if (out.includes(name)) out = out.split(name).join(placeholder("ব্যক্তি", canonical.get(name)!)); // prettier-ignore
      }
      return out;
    },
    unmask(text) {
      return text.replace(/\[(?:NID|ফোন|ব্যক্তি)-[০-৯]+\]/g, (p) => toValue.get(p) ?? p);
    },
    get size() {
      return toValue.size;
    },
  };
}

/** Recursively mask every string inside a JSON-like value (tool inputs, content blocks). */
export function maskDeep<T>(value: T, m: Masker, fn: "mask" | "unmask" = "mask"): T {
  if (typeof value === "string") return m[fn](value) as T;
  if (Array.isArray(value)) return value.map((v) => maskDeep(v, m, fn)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Opaque provider fields (signatures, ids) must stay byte-for-byte unchanged.
      out[k] = k === "signature" || k === "_gemini_sig" || k === "id" || k === "tool_use_id" ? v : maskDeep(v, m, fn); // prettier-ignore
    }
    return out as T;
  }
  return value;
}

// ---------- names from the records ----------

let namesCache: { at: number; names: string[][] } | undefined;

/** Owner names (Bangla + English) from the database, cached for 5 minutes. Empty if no DB. */
export async function knownNames(): Promise<string[][]> {
  if (namesCache && Date.now() - namesCache.at < 5 * 60_000) return namesCache.names;
  try {
    const { getSql } = await import("../sql");
    const rows = await getSql()<{ name_bn: string; name_en: string; kind: string }[]>`
      select name_bn, name_en, kind from owners where kind = 'person'`;
    // One group per person: full and short forms people type ("রহিম উদ্দিন" for
    // "মোঃ রহিম উদ্দিন"), Bangla and English. All map to the same placeholder.
    const names = rows.map((r) => [
      r.name_bn,
      r.name_bn.replace(/^(মোঃ|মোহাম্মদ|হাজী)\s+/, ""),
      r.name_en,
      r.name_en.replace(/^(Md\.|Haji)\s+/, ""),
    ]);
    namesCache = { at: Date.now(), names };
    return names;
  } catch {
    return [];
  }
}
