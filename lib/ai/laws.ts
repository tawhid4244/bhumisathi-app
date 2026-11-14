import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// The law library: content/laws/*.md (one cited section each, written in our own words)
// and content/qa.json (common questions linked to law ids). Read straight from the repo,
// so the AI can only cite what is in these files.

export interface LawDoc {
  id: string;
  law_en: string;
  law_bn: string;
  section: string;
  title_en: string;
  title_bn: string;
  source: string;
  verified: string;
  keywords: string;
  /** Other law ids to cite alongside this one (e.g. the fee schedule cites SAT Act s.143). */
  related: string[];
  body: string;
}

export interface Chunk {
  id: string; // "law:<id>" or "qa:<id>"
  kind: "law" | "qa";
  law_ids: string[];
  text: string; // what is searched and embedded
  hash: string;
}

const root = () => path.join(process.cwd(), "content");

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new Error("Law file is missing its --- front matter ---");
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0)
      meta[line.slice(0, i).trim()] = line
        .slice(i + 1)
        .trim()
        .replace(/^"(.*)"$/, "$1");
  }
  return { meta, body: m[2]!.trim() };
}

const REQUIRED = [
  "id",
  "law_en",
  "law_bn",
  "section",
  "title_en",
  "title_bn",
  "source",
  "verified",
];

export function loadLawDocs(dir = path.join(root(), "laws")): LawDoc[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const { meta, body } = parseFrontMatter(readFileSync(path.join(dir, f), "utf8"));
      for (const k of REQUIRED) if (!meta[k]) throw new Error(`${f}: missing "${k}"`);
      return {
        ...(meta as unknown as Omit<LawDoc, "body" | "related">),
        keywords: meta.keywords ?? "",
        related: (meta.related ?? "")
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
        body,
      };
    });
}

interface QaItem {
  id: string;
  question_bn: string;
  question_en: string;
  answer_bn: string;
  law_ids: string[];
}

export function loadQa(file = path.join(root(), "qa.json")): QaItem[] {
  return (JSON.parse(readFileSync(file, "utf8")) as { items: QaItem[] }).items;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

/** Every searchable piece: one per law file, one per Q&A item. */
export function buildChunks(docs = loadLawDocs(), qa = loadQa()): Chunk[] {
  const ids = new Set(docs.map((d) => d.id));
  for (const d of docs) {
    for (const r of d.related)
      if (!ids.has(r)) throw new Error(`${d.id} relates to unknown law "${r}"`);
  }
  const chunks: Chunk[] = docs.map((d) => {
    const text = [d.title_bn, d.title_en, d.law_bn, d.law_en, `ধারা ${d.section}`, d.keywords, d.keywords, d.body].join("\n"); // prettier-ignore
    return { id: `law:${d.id}`, kind: "law", law_ids: [d.id], text, hash: sha(text) };
  });
  for (const q of qa) {
    for (const id of q.law_ids)
      if (!ids.has(id)) throw new Error(`${q.id} cites unknown law "${id}"`);
    const text = [q.question_bn, q.question_en, q.answer_bn].join("\n");
    chunks.push({ id: `qa:${q.id}`, kind: "qa", law_ids: q.law_ids, text, hash: sha(text) });
  }
  return chunks;
}

let cache: { docs: LawDoc[]; chunks: Chunk[] } | undefined;

/** Cached copy of the library (files do not change while the app runs). */
export function lawLibrary(): { docs: LawDoc[]; chunks: Chunk[] } {
  if (!cache) {
    const docs = loadLawDocs();
    cache = { docs, chunks: buildChunks(docs) };
  }
  return cache;
}
