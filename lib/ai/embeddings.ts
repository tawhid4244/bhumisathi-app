import { GoogleGenAI } from "@google/genai";

// Text → vector, for semantic search over the law library. Gemini embeddings, same key as chat
// unless EMBEDDING_API_KEY is set. Returns null when not configured, so search falls back to
// keywords instead of failing.

export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIM = 768;

export interface Embedder {
  model: string;
  embed(texts: string[], kind: "document" | "query"): Promise<number[][]>;
}

let cached: Embedder | null | undefined;

export function getEmbedder(): Embedder | null {
  if (cached !== undefined) return cached;
  const provider = (process.env.EMBEDDING_PROVIDER || process.env.AI_PROVIDER || "").toLowerCase();
  const key = process.env.EMBEDDING_API_KEY || process.env.AI_API_KEY;
  if (provider !== "gemini" || !key) return (cached = null);
  const ai = new GoogleGenAI({ apiKey: key });
  const model = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  cached = {
    model,
    async embed(texts, kind) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += 50) {
        const res = await ai.models.embedContent({
          model,
          // Each text as its own Content: a plain string[] would be merged into ONE embedding.
          contents: texts.slice(i, i + 50).map((text) => ({ parts: [{ text }] })),
          config: {
            taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
            outputDimensionality: EMBEDDING_DIM,
            httpOptions: { timeout: 20_000 },
          },
        });
        for (const e of res.embeddings ?? []) out.push(e.values ?? []);
      }
      if (out.length !== texts.length) throw new Error("Embedding count mismatch");
      return out;
    },
  };
  return cached;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
