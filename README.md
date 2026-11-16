# ভূমিসাথী · BhumiSathi — এক জমি, এক সত্য (one plot, one truth)

A Bangla-first, voice-ready land helper for Bangladesh. Before you buy land it tells you — in plain
Bangla — who holds it, how much can really be sold, and whether there is a court case, mortgage,
earlier baina or khas claim. Its **share ledger** makes it impossible to register the same share of
a plot twice.

Prototype for the **International AI Builders Congress 2026** (CivicSphere AI → Citizen First,
LandTech track).

- **Live:** https://bhumisathi-app.vercel.app — press **“▶ জাজ মোড / Judge mode”** for a 3-minute tour.
- **All data is synthetic.** Fictional people, NIDs like `SYN-0000-0001`, phones `+880-SYN-0001`.
  This is **not a government website** and **not legal advice**; it checks records, it does not
  decide ownership.

---

## The problem

Land is the largest asset most Bangladeshi families own, and land disputes fill the courts. A common
root is that the record is spread across four surveys (CS, SA, RS, BS), deeds, bainas, mortgages and
mutation files, so the same plot can be sold twice, a mortgaged share can be sold, or khas land
changes hands. Citizens rarely read the paperwork themselves and pay brokers to explain it.

## What BhumiSathi does

|     | Feature                                                                                                                                                                                                                                                                             | Where                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | **Jomi Check** — red / amber / green report for a dag: holders, sellable share, CS→SA→RS→BS chain, court cases, liens, bainas, khas, tax, map-vs-khatian area                                                                                                                       | `/check`                               |
| 2   | **Share ledger** — baina, sale and mortgage go through one database function with a row lock; anything above the sellable share is refused, SMS go out, a mutation case opens                                                                                                       | `/registry` (officers)                 |
| 3   | **Sathi AI** — Bangla (or English) chat and push-to-talk voice; it calls the same tools, cites the law section, reads numbers back, and never records anything without the citizen's “Yes”                                                                                          | `/chat`                                |
| 4   | **Deed reader** — a photo of a deed → plain Bangla summary → cross-checked against the records and the map                                                                                                                                                                          | `/deed`                                |
| 5   | **Mouza map** — a dag's area in decimals, katha, bigha, acres; measure on your own map photo                                                                                                                                                                                        | `/map`                                 |
| 6   | **Warish (inheritance)** — Hanafi faraid with 'awl, radd, MFLO 1961 s.4, shares per dag, mock OTP consent, bontonnama → mutation checklist                                                                                                                                          | `/warish`                              |
| 7   | **BhumiSeal-lite** — Ed25519-signed report as a QR; `/verify` shows four lights: genuine, current, untouched, shares add up                                                                                                                                                         | `/check` → `/verify`                   |
| 8   | **Who checked my land** — every view and write in a hash-chained audit log; holders see who looked (role only)                                                                                                                                                                      | `/my-land`                             |
| 9   | Units (kani-gonda, bigha-katha, regional sizes), official fees with sources, office/admin view, judge mode                                                                                                                                                                          | `/units`, `/fees`, `/admin`, `/judge`  |
| 10  | **Land services** — the 11 services of land.gov.bd in one catalogue; apply for a certified khatian copy (wizard), pay in a **sandbox**, track it (also by number without signing in), officer inbox with deadlines, **signed copy with QR** checked on `/verify/doc`; notifications | `/services`, `/my`, `/track`, `/inbox` |

Every screen works in **বাংলা and English** (switch in the header) and at **phone width (375 px)**.

### Golden scenarios (all tested end to end)

G1 double sale blocked · G2 inheritance per dag · G3 deed + area mismatch · G4 khas land ·
G5 mortgage and court case · G6 cited legal answer · G7 BhumiSeal · G8 voice to action
(details: [docs/GOLDEN_SCENARIOS.md](docs/GOLDEN_SCENARIOS.md)).

## Try it

1. Open https://bhumisathi-app.vercel.app and press **Judge mode** — it resets the synthetic world
   and walks G1 → G3 → G8 → G2 → G7 with captions (no account needed).
2. Check land without an account: `/check`, dag **141** (green), **142** (court case), **145**
   (baina), **146** (mortgage), **149** (khas).
3. Signed-in features use the synthetic demo accounts below. **The password is not published here**;
   ask the team (it is `DEMO_USER_PASSWORD` in the deployer's `.env.local`).

| Role                                       | Email                           | Can                                                       |
| ------------------------------------------ | ------------------------------- | --------------------------------------------------------- |
| Citizen (Anwar Hossain, holder of dag 141) | `citizen@demo.bhumisathi.test`  | Sathi AI, deed reader, sealed report, who checked my land |
| Citizen 2                                  | `citizen2@demo.bhumisathi.test` | same; cannot see citizen 1's deeds                        |
| Sub-registry officer                       | `officer@demo.bhumisathi.test`  | sub-registry desk, office view                            |
| Admin                                      | `admin@demo.bhumisathi.test`    | everything + demo reset, unlock accounts                  |

## Run it on your computer (about 15 minutes)

Needs **Node.js 22+** and Git. No Docker: a local PostgreSQL 17 is downloaded as an npm package.
On Windows PowerShell use `npm.cmd` / `npx.cmd` instead of `npm` / `npx`.

```bash
git clone https://github.com/tawhid4244/bhumisathi-app.git
cd bhumisathi-app
npm install
cp .env.example .env.local        # Windows: copy .env.example .env.local
npm run users                     # starts local Postgres, creates secrets + demo accounts (password goes into .env.local, not shown)
npm run seed                      # migrations + the deterministic synthetic world (seed 2026)
```

Choose the AI:

- **No key (quickest):** set `AI_PROVIDER=mock` in `.env.local` — scripted answers for the golden
  questions, a mock deed reader, no cost.
- **Gemini (free tier):** `npm run set-key` → type `gemini` → paste a key from
  https://aistudio.google.com/apikey (input is hidden). Optional: `npm run embed` caches law
  embeddings for semantic search.

```bash
npm run dev                       # http://localhost:3000
```

Your demo password: `DEMO_USER_PASSWORD` in `.env.local`.

### Tests

```bash
npm run check      # typecheck + lint + unit + integration (279 tests, needs the local DB)
npm run e2e        # Playwright: every golden scenario + accessibility, at 375 px and desktop
npm run eval:ai    # 20 held-out questions on the real model (uses AI quota)
```

### Deploy

Vercel (region Singapore) + Supabase Postgres (Singapore). Step by step, with secrets never pasted
anywhere: [docs/DEPLOY.md](docs/DEPLOY.md). Health check: `/api/health` (yes/no only, no values).

## AI tools and models — every one, and what for

**Inside the product**

| Model / tool                                      | Used for                                                                                                   | Where                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Google Gemini `gemini-3.1-flash-lite`** (quick) | Sathi AI agent, tried first on every step: picks tools, explains results, cites laws (~1–2 s a step)       | `lib/ai/gemini.ts`, `lib/ai/agent.ts`        |
| Gemini `gemini-3.5-flash`, `gemini-3.8-flash`     | Main model for officer write requests; automatic fallbacks when the quick one is busy                      | `lib/ai/gemini.ts`                           |
| Fast path (no model)                              | "Check dag N", "area of dag N", unit conversion: answered from the tools in code in ~0.02 s                | `lib/ai/intent.ts`, `lib/ai/fast-answers.ts` |
| Gemini (vision, same models)                      | Reads a deed photo into structured fields (JSON schema); the verdict is computed in code, not by the model | `lib/ai/vision.ts`                           |
| **Google `gemini-embedding-2`** (768-d)           | Embeddings for semantic search over the cited law summaries and Q&A (hybrid with keyword search)           | `lib/ai/embeddings.ts`, `lib/ai/rag.ts`      |
| **Anthropic Claude `claude-opus-5-5`** (optional) | Alternative agent provider (`AI_PROVIDER=anthropic`)                                                       | `lib/ai/provider.ts`                         |
| Scripted mock provider                            | Deterministic answers for tests and offline demos                                                          | `lib/ai/mock-provider.ts`                    |
| Browser Web Speech API (`bn-BD`)                  | Push-to-talk speech-to-text and spoken replies, on the user's device                                       | `components/chat`                            |

The AI **never decides ownership, never writes to the ledger on its own** (writes need the
citizen's “Yes” and an officer role), and only sees masked NIDs, phones and names.
Results of the 20-question evaluation: [docs/AI_EVAL.md](docs/AI_EVAL.md).

**Used to build it:** the code, tests and documents were written with **Claude Code (Claude Opus
5.5, Anthropic)** working under the team's direction, following `CLAUDE.md`, `docs/PLAN.md` and the
golden scenarios. Every change was checked by automated tests before it was committed.

## Tech

Next.js 16 (App Router, React 19, TypeScript strict) · Tailwind CSS 4 · PostgreSQL 17 with Row Level
Security (Supabase in the cloud, embedded Postgres locally) · postgres.js · zod · Vitest + Playwright
(+ axe) · Vercel. Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Security:
[docs/SECURITY.md](docs/SECURITY.md).

```
app/           pages and API routes (/api/tools/{name}, /api/agent, /api/auth, …)
lib/engines/   one function per capability (ledger, rules, warish, area, units, fees, seal, audit)
lib/tools/     the registry: one typed tool per engine, used by pages, API and the AI agent
lib/ai/        agent loop, providers, RAG, vision, PII mask
lib/auth/      passwords, sessions, roles, RLS helper
supabase/migrations/   schema, share ledger, auth + RLS, audit log, cloud hardening
content/       law summaries (with sources), Q&A, fees, units, sample deed, mouza map
tests/         unit, integration (real database), e2e (one file per golden scenario)
docs/          plan, progress log, architecture, security, deploy, video script
```

## Honesty notes

- Synthetic data only; no real records, people or NIDs. Government systems are never called.
- The 11 law summaries in `content/laws` are written in our own words with sources and a
  “verified?” note; they still need review by a land-law mentor. Fees marked unverified say so.
- The real microphone flow is tested by hand (`docs/VOICE_TESTING.md`); automated tests use a fake
  speech engine.

## Roadmap

1. **Full BhumiSeal** — a public append-only Merkle log of every seal and ledger event, with
   inclusion proofs, and a **share-sum proof** that a dag's shares always add up across surveys.
2. **Multi-office approval** — sale, mutation and partition approved with signatures from the
   sub-registry, AC Land and union land offices (no single desk can push a transfer through).
3. **Escrow** — buyer's money held until registration and mutation complete; released or refunded
   automatically.
4. **Government integration** — read-only adapters to the national land record, e-mutation,
   land development tax and the registration system, replacing the mocks in `lib/adapters/`,
   behind official APIs and agreements.
5. Owner self-lock (freeze my land against sales), real SMS, Hindu and Christian succession law,
   more regional units, offline-first mobile.

---

**Team BhumiSathi** · built for the International AI Builders Congress 2026.
