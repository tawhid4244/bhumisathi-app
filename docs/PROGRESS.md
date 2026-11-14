# Progress log (handover between sessions)

Update at the end of every task and at the end of every session. Newest entry first.

## Status

| Session | Tasks | State |
| --- | --- | --- |
| 1 | 1–5 | in progress (task 1 done) |
| 2 | 6–10 | not started |
| 3 | 11–15 | not started |
| 4 | 16–20 | not started |

## Golden scenarios

| G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| – | – | – | – | – | – | – | – |

## Entries

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
