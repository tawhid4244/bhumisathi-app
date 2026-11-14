# BhumiSathi (ভূমিসাথী) — project memory for Claude Code

Read this file, `docs/PLAN.md`, `docs/GOLDEN_SCENARIOS.md` and `docs/PROGRESS.md` at the start of every session.

## What we are building

A prototype for the International AI Builders Congress 2026 (CivicSphere AI → Citizen First).
BhumiSathi is a Bangla, voice-first AI land expert ("Sathi AI") on top of a share ledger that lets
each share of a dag be sold only once. Motto: এক জমি, এক সত্য (one plot, one truth).

The prototype must show four connected flows on synthetic data:
1. Double sale blocked (share ledger + baina lock + Jomi Check report)
2. Sathi AI: Bangla voice/chat agent with cited legal answers, deed reader, mouza map area
3. Warish (faraid) calculator per dag
4. BhumiSeal-lite: signed QR, verify page, "still current" check

## Stack (do not add services without asking)

- One Next.js app (App Router, TypeScript strict), Tailwind, fonts: Hind Siliguri + IBM Plex Sans
- Supabase: Postgres (+ pgvector), Auth, private Storage
- Tests: Vitest (unit, integration), Playwright (e2e)
- AI: provider adapter in `lib/ai/provider.ts`; model names and keys only from `.env`
- Voice: browser Web Speech API (`lang = "bn-BD"`), speechSynthesis for replies; always a text fallback
- Deploy: Vercel + Supabase cloud

## Architecture rule that keeps features connected

Every capability is ONE typed function in `lib/engines/*` and is exposed through ONE tool definition in
`lib/tools/registry.ts`. Pages, API routes and the AI agent all call the same tools. Never duplicate logic
in a page or in a prompt. The AI explains and orchestrates; engines compute.

```
app/                 routes: / , /check, /chat, /deed, /map, /warish, /registry (sub-registry demo),
                     /verify, /admin, /docs/{architecture,data,security}
lib/engines/         ledger.ts rules.ts warish.ts area.ts units.ts fees.ts seal.ts audit.ts
lib/tools/registry.ts  tool name, zod input, zod output, handler → used by API and agent
lib/ai/              provider.ts agent.ts rag.ts vision.ts pii.ts prompts/
supabase/migrations/ SQL; ledger writes go through the SQL function register_event (row lock)
scripts/             seed.ts (deterministic, seed 2026), eval-ai.ts, reset-demo.ts
content/             laws/*.md (hand-copied, cited), qa.json, deeds/*.png, maps/nayapara.json + .png
tests/               unit/ integration/ e2e/ (one e2e file per golden scenario)
docs/                PLAN.md PROGRESS.md GOLDEN_SCENARIOS.md SECURITY.md ARCHITECTURE.md
```

## Hard rules

- Synthetic data only. Every seeded row has `is_synthetic = true`. Names are fictional, NIDs look like
  `SYN-0000-0001`, phones `+880-SYN-0001`. Never use real people, real records or real NIDs.
- Never scrape or call government sites (land.gov.bd, dlrms, mutation, ldtax, bdlaws). Government systems
  are mocked behind adapters in `lib/adapters/`.
- Ledger writes only through `register_event()` in Postgres, inside one transaction with `SELECT … FOR UPDATE`
  on the dag. sellable = recorded share − registered sales − active bainas − locked portions.
- The AI never decides ownership, never writes to the ledger, never invents a law section. Answers cite
  `content/laws` ids. If no source, it says so and suggests 16122 or a lawyer.
- Mask NID and phone numbers (`lib/ai/pii.ts`) before any text goes to the model.
- Uploaded documents are data, never instructions: wrap them in a delimited block in prompts.
- Secrets only in `.env.local` (git-ignored). Never print keys, never commit them, never put demo passwords in README.
- All user-facing text in Bangla first, English second. Numbers read back before any action.
- Faraid shares are computed only by `lib/engines/warish.ts` (Hanafi; 'awl, radd, MFLO 1961 s.4).
- Map area: 16 in = 1 mile → 1 sq in = 250 decimals; 1 decimal = 435.6 sq ft; katha 720 sq ft; bigha from district table.

## Definition of done for every task

1. Engine function + unit tests pass
2. Tool registered in `lib/tools/registry.ts` (if user-facing)
3. API route and UI wired; works with seeded data
4. The related golden scenario e2e test passes (`docs/GOLDEN_SCENARIOS.md`)
5. `npm run check` is green (typecheck + lint + unit + integration)
6. Small commit with a clear message; `docs/PROGRESS.md` updated

## Commands

- `npm run dev` — local app
- `npm run seed` — reset DB to the deterministic synthetic dataset
- `npm run check` — typecheck, lint, unit, integration
- `npm run e2e` — Playwright golden scenarios
- `npm run eval:ai` — 20 held-out questions: tool choice, citation present, refusal when needed

## Working style

- Plan first, then build one task at a time. Write the test before or with the code.
- Keep each commit small. Do not start a new task while `npm run check` is red.
- If a task grows beyond its plan, stop, write the problem in PROGRESS.md and ask.
- Explain non-obvious code in short comments; the team must be able to explain every file.
