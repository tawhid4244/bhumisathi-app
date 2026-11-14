# Progress log (handover between sessions)

Update at the end of every task and at the end of every session. Newest entry first.

## Status

| Session | Tasks | State |
| --- | --- | --- |
| 1 | 1–5 | done (2026-11-14) |
| 2 | 6–10 | done (2026-11-15), verified on real Gemini |
| 3 | 11–15 | not started |
| 4 | 16–20 | not started |

## Golden scenarios

| G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pass | – | partial (check only) | pass | pass | pass (real Gemini) | – | pass (typed on real Gemini; voice e2e with fake speech; manual mic test pending) |

## Entries

### 2026-11-15 06:30 — Session 2 summary (tasks 6–10 done)
- Done: Sathi AI agent (Gemini by default, Claude adapter kept; mock model for tests), cited legal
  answers from 11 hand-checked law sections (RAG with Gemini embeddings), /chat with streaming,
  badges, sources and a Yes/No card before any write, Bangla voice with number read-back, privacy
  mask, document-as-data guard, and a 20-question evaluation.
- Tests: `npm run seed` OK; `npm run check` green (120); `npm run e2e` green (62, phone + desktop).
- AI evaluation (real gemini-3.5-flash, docs/AI_EVAL.md): correct tool 95%, verdict = /check 83%
  (the only miss was a Google 504 timeout; passed on retry), citation with the right law 100%,
  refusals 100%, write held for confirmation 100%, false "not sure" 0%.
- Golden scenarios: G1 PASS, G4 PASS, G5 PASS, G6 PASS (real Gemini), G8 PASS (typed on real Gemini;
  voice via fake speech engine; real microphone = manual, docs/VOICE_TESTING.md). G3 partial (deed
  reader in task 12). G2 (warish) and G7 (BhumiSeal) not built yet.
- Decisions this session: Gemini API (user's budget choice) with model discovery and fallbacks;
  manual agent loop so writes wait for the citizen; law files are own-words summaries with official
  sources; personal data masked before every model call.
- Known issues: free-tier Gemini is sometimes slow or times out (fallback chain helps; retry the
  question); Q&A and law summaries need mentor review; write tools and AI routes are open until
  task 16 (roles + rate limits); Gemini text is not token-streamed.
- Next step: Session 3, task 11 (warish / inheritance calculator).

### 2026-11-15 06:20 — Session 2, task 10 (guardrails + AI evaluation)
- Done: `lib/ai/pii.ts`: one-pass masking of NIDs (SYN- and 10/13/17-digit, Bangla or English
  digits), BD mobile numbers (01[3-9]…, +88, separators, +880-SYN-), and owner names from the records,
  with ALL spellings of a person (full, short "রহিম উদ্দিন", English) sharing one placeholder
  [ব্যক্তি-১]; reversible `unmask`; signatures and ids never touched. The agent sends only a masked
  copy to the model and unmasks the answer and tool inputs. `lib/ai/documents.ts`: `wrapDocument`
  (labelled data-only block, fake closing tags neutralised); tools marked `untrusted` (law_search now,
  deed_read in task 12) are wrapped. New tool `find_person` (buyer/bank id by name; tolerates Bangla
  endings). Prompt: "law_search first" for every legal topic; how to get ids for writes;
  placeholders explained. Gemini timeout 45 s. `content/eval-questions.json` (20 held-out) +
  `scripts/eval-ai.ts` (`npm run eval:ai`, `npm run eval:ai -- E15` for one question).
- Tests: 120 green: PII unit tests (formats, no false hits on dag/area/year/money, one placeholder per
  person, unmask), agent test proving no NID/phone/name reaches the model and the citizen sees real
  names, document wrapper tests, a model "fooled" by an injected document still cannot write (sale
  held as pending), find_person.
- Eval history: run 1 found 4 real bugs (two placeholders for one person; no buyer lookup; heba answered
  from memory; grader missed polite refusals) → fixed → final run above.

### 2026-11-15 04:10 — Session 2, task 9 (voice)
- Done: `lib/voice.ts` (extractNumbers for Bangla/English digits; `readBackQuestion` →
  "আপনি কি ১৪৫ নম্বর দাগ বলেছেন? ঠিক আছে?" or a list of all numbers; `speakable` strips markdown,
  links and cuts at a sentence end; recognizer detection (SpeechRecognition or webkit prefix);
  `speak` picks a bn-BD voice when the device has one). `/chat`: mic button (tap to talk, `bn-BD`
  or `en-US` with the toggle; red pulse while listening), read-back card before sending anything
  with numbers ("হ্যাঁ, পাঠান" / "না, ঠিক করি" puts the text in the box), spoken reply for spoken
  questions (or the confirmation read-back), "▶ শুনুন" on every answer, clear messages for blocked
  mic / not understood, no mic button where unsupported (typed path unchanged).
  `docs/VOICE_TESTING.md`: manual Chrome test steps and troubleshooting.
- Tests: npm run check green (109; +8 voice unit tests). npm run e2e green (62): new
  `g8-voice.spec.ts` with a fake speech engine: read-back shown and spoken, nothing sent before Yes,
  then jomi_check → "সবুজ" (same verdict chip as /check) and the answer is spoken; "না, ঠিক করি";
  no-number speech sent directly; blocked mic message + typing still works; no mic without support.
- Known issues: Bangla number WORDS ("একশো পঁয়তাল্লিশ") rely on Chrome writing digits; Windows often
  has no Bangla text-to-speech voice (use Android Chrome for the demo). Real-microphone test is manual.
- Next step: task 10 (PII masking, document-as-data guard, 20-question AI evaluation).

### 2026-11-15 03:20 — Session 2, task 8 (/chat page)
- Done: `POST /api/agent/stream` (NDJSON events: text, tool badge, pending action, done, error);
  shared request checks in `lib/ai/agent-request.ts` (size limit, either message or confirmation,
  `lang`), lean `ToolBadge`s (verdict for jomi_check, ref/blocked reason for writes).
  `/chat` (`components/chat/ChatPanel.tsx`): streamed answers, tool badges ("জমি যাচাই করা হয়েছে"),
  verdict chip linking to `/check?mouza=…&no=…`, sources list under legal answers ("ধারা ১৪৩",
  link to the official page), amber Yes/No confirmation card before any write (text box locked until
  answered; card removed after one press), বাংলা/English toggle (screen text + `replyLanguage`),
  suggestion chips, new-conversation button, sticky input, safe mini-markdown renderer (no HTML
  injection). `AI_PROVIDER=mock` (`lib/ai/mock-provider.ts`): scripted model with the real tool
  protocol, used by browser tests. Removed obsolete `interest-cohort` from Permissions-Policy
  (browser warning).
- Tests: npm run check green (101). npm run e2e green: 52 (mobile 375 px + desktop), new
  `chat.spec.ts`: G8 typed (badge, "সবুজ", chip → /check shows the same verdict), G6 (Tk 1,170 +
  sources "ধারা ১৪৩" with https link), Yes registers B-0021 and nothing is written before Yes, No
  records nothing, no-source refusal, English toggle, no horizontal scroll at 375 px.
  REAL: /api/agent/stream with Gemini → find_dag → jomi_check (green) → Bangla answer with caveat.
- Known issues: Gemini adapter is not token-streamed (text arrives in one piece per step); a
  Windows command-line curl mangles Bangla unless the body is sent from a UTF-8 file (test-only).
- Next step: task 9 (voice: push-to-talk, number read-back, speech reply).

### 2026-11-15 02:30 — Session 2, task 7 (legal knowledge with sources, RAG)
- Research: official texts read on bdlaws.minlaw.gov.bd with the built-in browser (the automated
  fetcher is blocked for .gov.bd): SAT Act 1950 s.143 and s.143B; MFLO 1961 s.4; Registration Act
  1908 s.17 and s.17A (**baina must be registered within 60 days since 1 Jan 2026; was 30**, Registration
  (Amendment) Act 2026, Act 14 of 2026); TPA 1882 s.52; Land Crime Prevention and Remedy Act 2023
  (Act 36) s.4 (land fraud incl. transferring more than one's own land, up to 7 years), s.7–8
  (possession; Executive Magistrate, 3 months), s.23 (integrated database). Mutation fee Tk 1,170
  = 20 + 50 + 1,000 + 100 is consistent across BSS and union portals found by search, but the portal
  pages have moved (404), so the file says "confirm at AC Land office". The 28-day mutation limit
  could NOT be confirmed officially, so it is not in the library.
- Done: `content/laws/*.md` (11 files, own-words Bangla + English summaries, front matter with
  section, official source URL, how it was verified, keywords, related sections);
  `content/qa.json` (30 draft Q&A linked to law ids, `reviewed_by_mentor: false`).
  `lib/ai/laws.ts` (loads + validates library, chunks), `lib/ai/embeddings.ts` (Gemini
  `gemini-embedding-2`, 768-d; each text sent as its own Content), migration 0003 `law_embeddings`
  (real[] cache with content hash), `scripts/embed.ts` (`npm run embed`, only changed texts),
  `lib/ai/rag.ts` (hybrid: Bangla-ending-tolerant keyword score + cosine; MIN_SCORE 0.3 → empty =
  no source; related sections added), tool `law_search`, `AgentResult.sources`, prompt rules
  (answer only from law_search, end with "সূত্র: …", say "confirm locally" when the source says so,
  refusal phrase + 16122/lawyer otherwise, strategy questions go to a lawyer).
  next.config ships content/laws with the API routes.
- Tests: npm run check green (101): library integrity, keyword search (G6 → mutation-fee first +
  SAT s.143 via related; endings; other topics; unrelated questions → []), semantic lift and
  fallback with a fake embedder, G6 agent tests (cited answer with sources; no-source refusal).
  REAL: `npm run embed` → 41 chunks embedded, re-run 0 (cache works). `npm run ai:g6` → PASS both:
  Tk 1,170 breakdown + documents + "সূত্র: … ধারা ১৪৩"; litigation-strategy question declined →
  lawyer + 16122.
- Decisions: embeddings in real[] instead of pgvector (local server has no pgvector; 41 chunks).
  Law files are summaries in our own words, not copies of the statute text.
- Known issues: Q&A and summaries need faculty-mentor review before the final round.
- Next step: task 8 (/chat page).

### 2026-11-15 01:20 — Session 2, task 6c (real Gemini run)
- Done: user saved a Gemini key with `npm.cmd run set-key` (PowerShell blocks `npm.ps1`; `npm.cmd`
  works without changing the execution policy). `npm run ai:models` lists the models a key can use.
  Findings on 2026-11-15: `gemini-flash-latest` does not exist; `gemini-2.5-flash` is closed to new
  users; `gemini-3.8-flash` was overloaded (504 after 44 s); `gemini-3.5-flash` answered. Default is now
  `gemini-3.5-flash`, backups `gemini-3.8-flash`, `gemini-3.1-flash-lite` (`AI_FALLBACK_MODELS`);
  30 s timeout per request; 429/503 retried once after a short wait, a 504 moves straight to the next
  model; Gemini thinking level LOW for quick replies.
- Tests: npm run check green (88, incl. retry/fallback/timeout tests with an injected fake client).
  REAL: `npm run ai:spike` → Gemini called `jomi_check({mouza:"নয়াপাড়া", dag_no:145})`.
  `npm run ai:g8` → find_dag(145) → jomi_check(নয়াপাড়া, 145) → Bangla answer "সবুজ" with the
  "risk check, not a legal ruling" note and a next step; agent verdict = /check verdict → G8 PASS.
- Known issues: free-tier Gemini can be slow or busy at peak times; the fallback chain covers it.
  Thought signatures from one model are passed to a backup model unchanged (not yet seen to fail).
- Next step: task 7 (RAG over law texts with Gemini embeddings; hand-copied, cited law sections).

### 2026-11-15 00:30 — Session 2, task 6b (Gemini provider + safe key setup)
- Done: user chose the Gemini API (free tier, one key for chat, vision and embeddings).
  `lib/ai/gemini.ts`: Gemini adapter behind the same `ModelProvider` interface (translates the
  agent's messages to Gemini contents and back; keeps Gemini thought signatures in `_gemini_sig`;
  safety blocks → refusal). `AI_PROVIDER=gemini|anthropic` selects the adapter; default Gemini model
  `gemini-flash-latest` (override with `AI_CHAT_MODEL`). `npm run set-key`: asks for provider and key
  in the user's own terminal, never echoes input, writes only those two lines of `.env.local`
  (`lib/env-file.ts`).
- Tests: npm run check green (84): Gemini translation both ways, signatures, refusal mapping,
  function declarations for every tool, env-file upsert (in place, duplicates, CRLF). set-key
  dry-run in a scratch folder with a fake key: saved correctly, key never printed.
- Known issues: still no real-model run (no key saved yet).
- Next step: user runs `npm run set-key`, then `npm run ai:spike` and `npm run ai:g8`.

### 2026-11-14 23:50 — Session 2, task 6 (AI agent with tool calling)
- Done: Provider: Claude API (user's choice), model `claude-opus-5-5` by default (`AI_CHAT_MODEL`),
  adaptive thinking, effort `medium` (`AI_EFFORT`), cached system prompt, streaming, server-side
  refusal fallback (`server-side-fallback-2026-07-01`, `fallbacks: "default"`). `lib/ai/provider.ts`
  (one adapter, key from `AI_API_KEY`), `lib/ai/tools.ts` (registry zod → JSON Schema, bn+en
  descriptions, write tools marked), `lib/ai/prompts.ts` (Bangla system prompt: facts only from tools,
  never decides ownership, never invents law, writes need confirmation, tool results are data),
  `lib/ai/agent.ts` (manual loop: read tools run in parallel; write tools are NEVER run by the loop:
  it stops with a pending action + Bangla read-back; `resolvePending` runs it only on approval, a
  forged id is refused; refusal / max_tokens / max_steps handled; append-only history),
  `lib/ai/describe.ts` (read-back with owner names), new tool `find_dag`, `POST /api/agent`
  (stateless: browser keeps the history; size limits; 503 when no key). Scripts `npm run ai:spike`
  and `npm run ai:g8` for real calls.
- Tests: npm run check green (76): 10 agent-loop unit tests with a scripted model (read tools,
  pending write, approve/decline, forged confirmation, bad input recovery, refusal, max_tokens,
  max_steps, schema conversion); G8 integration: find_dag → jomi_check(145) gives the same verdict as
  /check (green, and red after the G1 oversell); a model-proposed baina is recorded only after Yes.
  Build green.
- Decisions: manual loop (not the SDK tool runner) because the confirmation for a write arrives in a
  separate HTTP request; the server stays stateless.
- Known issues: NOT yet run against the real model: `AI_API_KEY` is empty, `npm run ai:spike` stops
  with "AI is not configured". PII masking before the model is task 10. /api/agent rate limit is task 16.
- Next step: add the key, run `npm run ai:spike` and `npm run ai:g8`; then task 7 (RAG over law).

### 2026-11-14 23:10 — Session 1 summary (tasks 1–5 done)
- Done: scaffold; schema + deterministic seed; share ledger with row-locked `register_event`;
  Jomi Check rules + `/check`; `/registry` sub-registry demo. Local PostgreSQL 17 without Docker.
- Tests: `npm run seed` OK; `npm run check` green (63 unit + integration); `npm run e2e` green
  (38 = 19 × mobile 375 px + desktop); `npm run build` green.
- Golden scenarios: G1 PASS (API, /check and /registry, incl. parallel double-sale test);
  G4 PASS; G5 PASS. G3 PARTIAL: /check already flags the dag 143 map mismatch and unmutated deed
  4512/2024; the deed reader is task 12. G2, G6, G7, G8 not built yet (sessions 2–4).
- Decisions this session: local embedded Postgres + DATABASE_URL (no Docker on this laptop); map
  scaled ×1.1 so dag 145 = 20 dec fits G1; SMS + mutation case written inside register_event; pending
  civil case blocks transfer (TPA 1882 s.52); refused oversell attempts make Jomi Check RED for 90 days.
- Known issues: write tools, /api/demo/reset and /api/demo/activity are open to anyone until task 16
  adds roles; strict nonce CSP waits for task 16; pgvector missing locally (task 7 needs a fallback);
  .env.local values are all empty (Supabase cloud + AI keys needed before task 6 real calls and task 19).
- Next step: Session 2, task 6 (AI agent). Needs an AI API key in .env.local for the real-model spike;
  the agent loop and its tests can be built with a mocked model first.

### 2026-11-14 23:05 — Session 1, task 5 (sub-registry demo)
- Done: `/registry` desk (client component over the registry tools): pick mouza + dag → ledger
  summary; choose sale / baina / mortgage, seller, buyer or bank, area (+ baina days) → `jomi_check` with
  that seller and area → verdict + read-back of every number ("ঠিক আছে?") → register through
  `register_*`; result banner (registered with deed no + mutation case, or blocked with the Bangla
  reason). Live panel: mock SMS log (never sent), mutation cases (28-day deadline), ledger events;
  "ডেমো রিসেট" button. `lib/engines/demo.ts`, `GET /api/demo/activity`.
- Tests: e2e G1 full flow on /registry (B-0021, 2 SMS, red check + blocked 15 dec with SMS to Buyer A,
  10 dec sale with mutation case, sellable 20 → 10 → 0), reset demo, G4 khas blocked at the desk,
  G5 146 mortgage and 142 court case blocked at the desk.
- Decisions: the desk always lets the officer press register and lets the ledger decide, so the
  database (not the UI) is the guard and Buyer A gets the warning SMS.

### 2026-11-14 22:40 — Session 1, task 4 (Jomi Check)
- Done: `lib/engines/records.ts` (loads all facts for a dag: holders, CS→SA→RS→BS chain, khas, cases,
  liens, bainas, unmutated deeds, tax, map area, refused oversell attempts in the last 90 days);
  `lib/engines/rules.ts` (pure rules: KHAS, COURT_CASE (TPA s.52), EXCEEDS_SELLABLE / SELLER_NOT_RECORDED
  for a specific request, BLOCKED_ATTEMPT, OWNER_DECEASED, MORTGAGE, BAINA, MUTATION_PENDING
  (SAT Act s.143), TAX_ARREARS (LD Tax Act 2023, one fiscal year of grace), MAP_MISMATCH (≥2 dec or ≥10%),
  MAP_SMALL_DIFF (info), CHAIN_MISMATCH (>1 dec between surveys); verdict = most serious);
  `lib/engines/jomi-check.ts` (lookup by dag or BS khatian); tool `jomi_check`.
  `/check` page: GET search form (mouza, dag or khatian, Bangla digits OK), big verdict banner with
  shape icon (colour-blind safe), reasons with legal basis, holder balance table, chain timeline,
  map vs khatian, disclaimer; works without JavaScript; empty, not-found and invalid-number states.
  `POST /api/demo/reset` (reseeds). Playwright global setup migrates + seeds.
- Tests: npm run check green (63). npm run e2e green (30, mobile + desktop): G1 on /check
  (green → amber after B-0021 → red "Requested area exceeds sellable balance"; Bangla digit search),
  G4 (149 red, sale blocked), G5 (146 amber Demo Bank, 142 red case 101/2025, mortgaged sale blocked).
  Seeded verdicts: 141 green, 142 red, 143 amber (map +3.04 dec, deed 4512 unmutated), 144 green,
  145 green, 146 amber, 147 amber (tax), 148 amber (chain), 149 red, Charpara 210 amber (deceased).
- Decisions: G1 "RED after step 2" is produced by a rule that flags a recent refused oversell attempt
  (a fraud signal a buyer should see), as well as by checking a specific request.
- Next step: task 5 (/registry demo screen).

### 2026-11-14 22:10 — Session 1, task 3 (share ledger)
- Done: Migration `0002_share_ledger.sql`: `ledger_events` (accepted AND rejected attempts), `sms_log`
  (mock outbox), `mutation_cases`, `dags.ledger_version`; views `bs_holdings`, `dag_locks`,
  `share_balances`, `share_sellable` (sellable = recorded − sales after the BS khatian − active unexpired
  bainas − active liens; 0 for khas, pending court case, or deceased owner). SQL `register_event()` locks
  the dag row and its share rows with `SELECT … FOR UPDATE`, recomputes the balance after the lock, then
  records or refuses with a Bangla + English reason that names what holds the share (baina id, lien id,
  deed no). Accepted sale → deed + mutation case (28-day deadline) + SMS; a buyer's own baina is
  usable by that buyer and marked completed; refused sale → SMS to baina holders. Sequences restart via
  `after_seed()` so the demo always issues B-0021 first. `lib/engines/ledger.ts` (computeSellable,
  resolveDag accepting Bangla/English mouza name, code or JL no, Bangla digits), tools `ledger_status`,
  `register_baina`, `register_sale`, `register_lien` (zod in/out, bn+en descriptions) in
  `lib/tools/ledger-tools.ts` and registered in `lib/tools/registry.ts`; `POST /api/tools/[name]`.
  `npm run db:reset` (local only; refuses when DATABASE_URL is set).
- Tests: npm run check green, 39 tests: balance maths; G1 steps 1–3 through the API route with the
  exact reason "only 10 decimals sellable; 10 reserved by baina B-0021", SMS and mutation case;
  2 parallel sales → exactly 1 succeeds; 10 parallel 3-dec sales of 20 dec → exactly 6; khas 149,
  case 142 (TPA s.52), lien 146 (15.9 sellable), non-holder seller, deceased owner, expired baina;
  SQL view = TS formula for every holder; API returns 400/404 on bad input.
- Decisions: SMS log and mutation case are written inside register_event (same transaction) instead of
  task 5, so a sale can never exist without its mutation case. A pending civil case blocks transfer
  (lis pendens, Transfer of Property Act 1882 s.52). Write tools are open on the API until task 16 adds
  roles (officer only).
- Next step: task 4 (Jomi Check rules + /check page).

### 2026-11-14 22:00 — Session 1, task 2 (schema + synthetic seed)
- Done: Migration `0001_core_schema.sql`: mouzas, dags, owners, khatians (CS/SA/RS/BS), khatian_dags,
  ownership_shares, deeds, bainas, liens, court_cases, khas_flags, land_tax, map_polygons; every table has
  `is_synthetic` default true; CHECK constraints reject real-looking NIDs/phones (only `SYN-0000-0001`,
  `+880-SYN-0001`). pgvector enabled where available. `scripts/seed-data.ts` builds the world
  (seed 2026, mulberry32 PRNG, no clock): 2 mouzas, 60 dags (Nayapara 141–179, Charpara 210–230),
  42 owners, 143 khatians with CS→SA→RS→BS chains (dag numbers shift between surveys), deed 4512/2024,
  khas dag 149 (khas khatian 1), Demo Bank lien L-0003 on 146, civil suit 101/2025 on 142, tax arrears on
  147, RS/BS area mismatch on 148, deceased Abdul Karim on Charpara 210/211. `scripts/seed.ts` runs
  migrations then truncates and inserts in one transaction. `lib/engines/area.ts` (shoelace, map scale).
- Tests: npm run check green: 18 tests (seed twice → identical md5 per table; every row synthetic;
  golden facts; DB rejects a real-looking NID/phone; area maths).
  Row counts: mouzas 2, owners 42, dags 60, khatians 143, khatian_dags 240, ownership_shares 254, deeds 2,
  bainas 1, liens 1, court_cases 2, khas_flags 1, land_tax 73, map_polygons 9.
- Decisions:
  - **Local database without Docker:** this laptop has no Docker/WSL, so local dev and tests use
    PostgreSQL 17 from the npm package `@embedded-postgres/windows-x64` (driven via initdb/pg_ctl in
    `scripts/local-db.ts`, data in `.pgdata/`, localhost only). Server code uses plain SQL through
    `postgres.js` (`lib/sql.ts`) and `DATABASE_URL`; empty = local, Supabase connection string = cloud.
    Migrations are applied by `scripts/migrate.ts` (works on both). Supabase JS stays for Auth/Storage.
  - **Map scaled ×1.1:** the original polygon for dag 145 measured 16.56 dec, which cannot hold Rahim's
    20 dec share in G1. Coordinates in `content/maps/nayapara.json` were multiplied by 1.1, so dag 145 =
    20.04 dec (khatian 20.0). G8 / task 13 now expect ≈20.0 dec. Khatian area = map area (0.1 dec) + offset.
  - Added `land_tax` table (needed for the "tax paid" rule of the Land Crime Prevention Act 2023).
  - About 60 dags: added table-only Nayapara 150–179 to reach 60.
- Known issues: pgvector is not in the local embedded server; task 7 needs a fallback locally.
- Next step: task 3 (share ledger).

### 2026-11-14 21:45 — Session 1, task 1 (scaffold)
- Done: Next.js 16.4.6 (App Router, Turbopack, Cache Components) + TypeScript strict + Tailwind 4;
  fonts Hind Siliguri (Bangla) + IBM Plex Sans, self-hosted by next/font. Vitest 5, Playwright 1.65
  (mobile 375 px + desktop projects), ESLint 9 + Prettier. Scripts: dev, build, check, e2e, seed, eval:ai
  (seed and eval:ai exit 1 with a "not built yet" message until tasks 2 and 10).
  Folder layout from CLAUDE.md. `lib/env.ts` (zod-validated env, errors never print values),
  `lib/db.ts` (anon client + server-only service client), `lib/tools/registry.ts` (defineTool/runTool,
  zod-validated input and output, read/write kinds). Bangla home page "ভূমিসাথী — এক জমি, এক সত্য"
  with links to /check, /chat, /warish, /map, /registry (placeholder pages naming the task that builds them).
  Security headers on every response (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, COOP,
  Permissions-Policy with microphone=self, CSP frame-ancestors/object-src/base-uri/form-action;
  no X-Powered-By). Supabase CLI 3.1.0 installed as a dev dependency (`npx supabase`).
- Tests: npm run check green (typecheck, lint, 7 unit tests). npm run build green (all pages static).
  npm run e2e green: 16/16 (home + 5 links + no horizontal scroll + security headers, mobile and desktop).
- Decisions: Kept create-next-app defaults for Next 16 (Cache Components on). Strict nonce-based script CSP
  is deferred to task 16 because it needs per-request rendering. `typecheck` runs `next typegen` first so
  Next's generated route types exist on a fresh clone. `.gitattributes` forces LF line endings.
  GitHub repo tawhid4244/bhumisathi-app created PRIVATE; switch to public before submission.
- Known issues: `npm audit` reports 7 moderate issues in the ESLint/typescript-eslint dev toolchain only
  (not shipped to users); left as is. All .env.local values are still empty.
- Next step: fill the three Supabase values in .env.local, run `npx supabase login` and
  `npx supabase link --project-ref <ref>`, then task 2 (schema + deterministic seed).

<!-- Template:
### YYYY-MM-DD HH:MM — Session N, task #
- Done:
- Tests: npm run check (green/red), e2e (which G pass)
- Decisions:
- Known issues:
- Next step:
-->
