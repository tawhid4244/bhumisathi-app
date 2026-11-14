// npm run embed → compute Gemini embeddings for content/laws + content/qa.json and cache them in
// the law_embeddings table. Only new or changed texts are sent (content_hash), so re-running is
// cheap. Without an embedding key the app still works with keyword search.
import type postgres from "postgres";
import { getEmbedder } from "../lib/ai/embeddings";
import { buildChunks } from "../lib/ai/laws";

export async function embedLibrary(
  sql: postgres.Sql,
): Promise<{ total: number; embedded: number }> {
  const embedder = getEmbedder();
  if (!embedder)
    throw new Error(
      "No embedding provider: set AI_PROVIDER=gemini and AI_API_KEY (npm run set-key).",
    );
  const chunks = buildChunks();
  const existing = new Map(
    (
      await sql<{ chunk_id: string; content_hash: string }[]>`
        select chunk_id, content_hash from law_embeddings where model = ${embedder.model}`
    ).map((r) => [r.chunk_id, r.content_hash]),
  );
  const todo = chunks.filter((c) => existing.get(c.id) !== c.hash);
  if (todo.length > 0) {
    const vectors = await embedder.embed(
      todo.map((c) => c.text),
      "document",
    );
    for (let i = 0; i < todo.length; i++) {
      const c = todo[i]!;
      await sql`
        insert into law_embeddings (chunk_id, content_hash, model, embedding)
        values (${c.id}, ${c.hash}, ${embedder.model}, ${vectors[i]!}::real[])
        on conflict (chunk_id) do update
          set content_hash = excluded.content_hash, model = excluded.model,
              embedding = excluded.embedding, updated_at = now()`;
    }
  }
  // Remove vectors for chunks that no longer exist.
  const ids = chunks.map((c) => c.id);
  await sql`delete from law_embeddings where not (chunk_id = any(${ids}::text[]))`;
  return { total: chunks.length, embedded: todo.length };
}

if (process.argv[1]?.endsWith("embed.ts")) {
  (async () => {
    const { ensureLocalDb } = await import("./local-db");
    const { migrate } = await import("./migrate");
    const { getSql, closeSql } = await import("../lib/sql");
    if (!process.env.DATABASE_URL) await ensureLocalDb();
    const sql = getSql();
    await migrate(sql);
    const r = await embedLibrary(sql);
    console.log(`Law library: ${r.total} chunks, ${r.embedded} newly embedded.`);
    await closeSql();
  })().catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
}
