-- Cached embeddings for the law library (task 7). The texts themselves live in content/laws and
-- content/qa.json (version-controlled); this table only stores their vectors so they are computed
-- once. content_hash tells scripts/embed.ts when a text changed and must be re-embedded.
-- Stored as real[] so it works on the local server (no pgvector) and on Supabase; with ~40 chunks
-- the cosine similarity is computed in the app. A pgvector index is only worth it at thousands.
create table law_embeddings (
  chunk_id     text primary key,
  content_hash text not null,
  model        text not null,
  embedding    real[] not null,
  updated_at   timestamptz not null default now()
);
