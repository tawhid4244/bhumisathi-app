import { getSql } from "../sql";
import { cosine, getEmbedder, type Embedder } from "./embeddings";
import { lawLibrary, type Chunk, type LawDoc } from "./laws";

// Retrieval over the law library (RAG). Two signals, combined:
//   1. keyword match (always available, no network), tolerant of Bangla word endings
//   2. semantic similarity from Gemini embeddings (when configured and cached by `npm run embed`)
// Results are law documents with their citation. Below MIN_SCORE nothing is returned, so the
// agent says "আমি নিশ্চিত নই…" instead of answering without a source.

export interface LawHit {
  law_id: string;
  law_bn: string;
  law_en: string;
  section: string;
  title_bn: string;
  title_en: string;
  source: string;
  verified: string;
  excerpt: string;
  score: number;
}

// Common words that carry no meaning for search (Bangla + English).
const STOP = new Set(
  (
    "আমি আমার আমাদের আপনি আপনার তুমি সে তিনি এটা এটি ওটা কি কী কে কেন কোন কোথায় কখন কীভাবে কিভাবে কত " +
    "আর এবং ও বা না নয় হয় হবে নিয়ম নিয়মে উপায় বিষয়ে সম্পর্কে হলে হয়ে হচ্ছে করতে করব করবো করে করা করলে কি আছে নেই যায় যাবে পারে পারব লাগবে লাগে " +
    "দিয়ে দিতে থেকে জন্য সাথে মধ্যে পর আগে এই সেই যে যদি তাহলে তবে শুধু খুব একটু আরও কথা বলুন বলে দেখাও জানতে চাই " +
    "the a an and or of to in on for is are be do does how what which who can i my me we our you your with about"
  ).split(/\s+/),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

/** Bangla adds endings (নামজারির, নামজারিতে); treat a shared start of 3+ letters as a match. */
function matches(q: string, d: string): boolean {
  if (q === d) return true;
  const min = Math.min([...q].length, [...d].length);
  return min >= 3 && (d.startsWith(q) || q.startsWith(d));
}

interface Indexed {
  chunk: Chunk;
  tokens: string[];
}

let index: { items: Indexed[]; df: Map<string, number> } | undefined;

function buildIndex(): NonNullable<typeof index> {
  if (index) return index;
  const items = lawLibrary().chunks.map((chunk) => ({
    chunk,
    tokens: [...new Set(tokenize(chunk.text))],
  }));
  const df = new Map<string, number>();
  for (const it of items) for (const t of it.tokens) df.set(t, (df.get(t) ?? 0) + 1);
  index = { items, df };
  return index;
}

/** 0..1: share of the query's (rarity-weighted) words found in the chunk. */
export function keywordScores(query: string): Map<string, number> {
  const { items } = buildIndex();
  const q = [...new Set(tokenize(query))];
  const n = items.length;
  // A query word's weight = how rare it is across the library (idf).
  const weight = (t: string) => {
    const df = items.filter((it) => it.tokens.some((d) => matches(t, d))).length;
    // A word the library never uses still counts in the total (as the rarest kind of word),
    // so a question about something else does not look like a match on one shared word.
    return Math.log(1 + n / Math.max(df, 0.5));
  };
  const w = q.map(weight);
  const total = w.reduce((a, b) => a + b, 0);
  const scores = new Map<string, number>();
  if (total === 0) return scores;
  for (const it of items) {
    let s = 0;
    q.forEach((t, i) => {
      if (it.tokens.some((d) => matches(t, d))) s += w[i]!;
    });
    if (s > 0) scores.set(it.chunk.id, s / total);
  }
  return scores;
}

/** Cached chunk vectors from the database (empty if not embedded yet or DB unavailable). */
async function cachedVectors(model: string): Promise<Map<string, number[]>> {
  try {
    const sql = getSql();
    const rows = await sql<{ chunk_id: string; content_hash: string; embedding: number[] }[]>`
      select chunk_id, content_hash, embedding from law_embeddings where model = ${model}`;
    const hashes = new Map(lawLibrary().chunks.map((c) => [c.id, c.hash]));
    // Only use vectors whose text has not changed since they were computed.
    return new Map(
      rows.filter((r) => hashes.get(r.chunk_id) === r.content_hash).map((r) => [r.chunk_id, r.embedding]), // prettier-ignore
    );
  } catch {
    return new Map();
  }
}

export const MIN_SCORE = 0.3;

export interface SearchOptions {
  k?: number;
  embedder?: Embedder | null;
  /** Injected in tests. */
  vectors?: Map<string, number[]>;
}

export async function searchLaws(query: string, opts: SearchOptions = {}): Promise<LawHit[]> {
  const k = opts.k ?? 3;
  const { docs, chunks } = lawLibrary();
  const kw = keywordScores(query);

  // Semantic scores, when available. A failure here must not break answering: keep keywords.
  let sem = new Map<string, number>();
  const embedder = opts.embedder === undefined ? getEmbedder() : opts.embedder;
  if (embedder) {
    try {
      const vectors = opts.vectors ?? (await cachedVectors(embedder.model));
      if (vectors.size > 0) {
        const [qv] = await embedder.embed([query], "query");
        for (const [id, v] of vectors) sem.set(id, cosine(qv!, v));
      }
    } catch {
      sem = new Map();
    }
  }

  // Combine per chunk, then keep the best chunk score for each law document.
  const best = new Map<string, number>();
  for (const c of chunks) {
    const s = sem.size
      ? 0.6 * Math.max(0, Math.min(1, ((sem.get(c.id) ?? 0) - 0.35) / 0.4)) + 0.4 * (kw.get(c.id) ?? 0) // prettier-ignore
      : (kw.get(c.id) ?? 0);
    if (s <= 0) continue;
    // A Q&A hit counts slightly less than the law text itself.
    const sc = c.kind === "qa" ? s * 0.95 : s;
    for (const id of c.law_ids) best.set(id, Math.max(best.get(id) ?? 0, sc));
  }

  const byId = new Map(docs.map((d) => [d.id, d]));
  const top = [...best.entries()]
    .filter(([, s]) => s >= MIN_SCORE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);
  // Bring in the sections a hit relies on (e.g. the fee schedule → SAT Act s.143).
  const ids = new Set(top.map(([id]) => id));
  for (const [id, score] of [...top]) {
    for (const r of byId.get(id)!.related) {
      if (!ids.has(r)) {
        ids.add(r);
        top.push([r, Math.round(score * 0.8 * 1000) / 1000]);
      }
    }
  }
  return top.map(([id, score]) => toHit(byId.get(id)!, score));
}

function toHit(d: LawDoc, score: number): LawHit {
  return {
    law_id: d.id,
    law_bn: d.law_bn,
    law_en: d.law_en,
    section: d.section,
    title_bn: d.title_bn,
    title_en: d.title_en,
    source: d.source,
    verified: d.verified,
    excerpt: d.body,
    score: Math.round(score * 1000) / 1000,
  };
}
