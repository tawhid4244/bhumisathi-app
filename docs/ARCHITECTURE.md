# BhumiSathi — architecture

One Next.js app, one Postgres database. The rule that keeps every feature consistent:

> **Every capability is one typed engine function (`lib/engines/*`), exposed once as a tool in
> `lib/tools/registry.ts`. Pages, the HTTP API and the AI agent all call the same tools.**
> The AI explains and orchestrates; engines compute; the database enforces.

## The big picture

```mermaid
flowchart LR
  subgraph Browser["Citizen / officer browser (phone-first, বাংলা | EN)"]
    UI["Pages: /check /chat /deed /map /warish /verify /registry /admin /judge"]
    Voice["Web Speech API (bn-BD)<br/>speech ⇄ text, on the device"]
  end

  subgraph Vercel["Next.js 16 on Vercel (Singapore)"]
    Proxy["proxy.ts<br/>CSRF origin check · signed-out redirect"]
    API["API routes<br/>/api/tools/{name} · /api/agent/stream · /api/auth/* · /api/judge/step · /api/health"]
    Registry["Tool registry<br/>zod input + output · access role · audit hook"]
    Engines["Engines<br/>ledger · rules · warish · area · units · fees · deed-check · seal · audit"]
    Agent["Sathi agent loop<br/>PII mask · document-as-data · write = pending until 'Yes'"]
    RAG["Law search<br/>keyword + embeddings over content/laws"]
  end

  subgraph AI["Model providers"]
    Gemini["Google Gemini<br/>3.5-flash (+ fallbacks) · vision · embedding-2"]
    Claude["Anthropic Claude (optional)"]
  end

  subgraph DB["PostgreSQL 17 (Supabase, Singapore) — RLS on every table"]
    Records["Records: mouzas, dags, khatians, owners,<br/>shares, deeds, cases, khas, tax, maps"]
    Ledger["Share ledger: register_event()<br/>row lock · bainas · liens · sales · SMS · mutation"]
    Auth["users · sessions · uploads (private bytes) · rate_limits"]
    Audit["audit_log: sha256 hash chain"]
  end

  UI --> Proxy --> API --> Registry --> Engines --> DB
  UI <--> Voice
  API --> Agent --> Registry
  Agent --> RAG
  Agent --> Gemini
  Agent -.-> Claude
  Engines --> Ledger
  Registry --> Audit
```

## How a request flows

**A citizen checks a dag** (`/check?mouza=nay&by=dag&no=145`): the page calls
`runTool("jomi_check", …, {user})` → the registry checks the role, validates input with zod → the
engine loads the dag's facts (record chain, holders, bainas, liens, cases, khas, tax, map polygon)
→ `rules.ts` turns them into reasons and a red/amber/green verdict → output is validated again →
the view is appended to the hash-chained audit log → the page renders it.

**An officer registers a sale** (`/registry`): the desk runs `jomi_check` with the seller and area,
reads the numbers back, and only on “Yes” calls `register_sale` → `register_event()` in SQL locks
the dag row (`SELECT … FOR UPDATE`), recomputes the sellable share
(recorded − sold − active bainas − liens; khas, a pending case or a deceased holder block it),
accepts or refuses, bumps the ledger version, writes SMS and opens a mutation case — all in one
transaction. Two parallel sales: exactly one wins (tested).

**Sathi AI answers** (`/api/agent/stream`):

```mermaid
sequenceDiagram
  participant C as Citizen
  participant R as /api/agent/stream
  participant A as Agent loop
  participant M as Model (Gemini)
  participant T as Tools (registry)
  C->>R: "১৪৫ নম্বর দাগ কেনা নিরাপদ?" (signed in, rate-limited)
  R->>A: messages + only the tools this role may use
  A->>A: mask NID / phone / owner names
  A->>M: system prompt + masked messages + tool list
  M-->>A: tool_use: jomi_check(Nayapara, 145)
  A->>T: runTool (role check, zod, audit)
  T-->>A: verdict + reasons (wrapped as data if it came from a document)
  A->>M: tool result
  M-->>A: Bangla answer citing the rule
  A-->>R: unmask names, stream text + tool badges + sources
  R-->>C: answer (and a Yes/No card if the model asked for a write)
```

Write tools (`register_*`) are **never** executed by the loop: it stops and returns a pending action;
it runs only when the citizen presses Yes on the next request, and only if their role allows it.

**A sealed report** (`/check` → “সিলযুক্ত রিপোর্ট নিন”): `seal_issue` signs
`{mouza, dag, area, verdict, holders, ledger_version, time, key id}` with Ed25519, records the
issue (seal id + payload hash) in the audit log and returns a QR to `/verify#BS1.<payload>.<sig>`.
`/verify` checks: genuine (signature), current (ledger version unchanged), untouched (issue found in
an intact audit chain), shares add up.

## Data model (main tables)

| Group | Tables |
|---|---|
| Land records | `mouzas`, `dags` (+ `ledger_version`), `khatians` (CS/SA/RS/BS), `khatian_dags`, `owners`, `ownership_shares`, `deeds`, `court_cases`, `khas_flags`, `land_tax`, `map_polygons` |
| Share ledger | `bainas`, `liens`, `ledger_events`, `sms_log`, `mutation_cases`; views `bs_holdings`, `share_balances`, `share_sellable`, `dag_locks`; function `register_event()` |
| Identity | `users` (role, scrypt hash, lockout, linked holder), `sessions` (token hash), `uploads` (owner + bytes), `rate_limits` |
| Trust | `audit_log` (hash chain, `append_audit()`), `law_embeddings` |

Migrations: `supabase/migrations/0001` … `0006`, applied by `scripts/migrate.ts`. The synthetic
world is built deterministically by `scripts/seed-data.ts` (seed 2026).

## Engines (each one is plain TypeScript with unit tests)

| Engine | Does |
|---|---|
| `ledger.ts` | resolve a dag, sellable balance per holder, register baina/sale/lien via SQL |
| `rules.ts` | facts → reasons → verdict (TPA 1882 s.52, SAT 1950 s.143, LCPRA 2023 …) |
| `warish.ts` | exact-fraction faraid ('awl, radd, umariyyatayn, MFLO s.4) with Bangla + English working |
| `area.ts`, `map.ts`, `units.ts` | shoelace area at 16″ = 1 mile, calibrated photo measuring, regional units |
| `deed-check.ts` | deed fields vs records and map → findings; plain summary |
| `seal.ts`, `audit.ts` | Ed25519 seals; hash-chained audit log and its verifier |

## AI layer (`lib/ai`)

- `provider.ts` — Gemini (default), Anthropic, or Mock, chosen by `AI_PROVIDER`.
- `gemini.ts` — fallback chain (3.5-flash → 3.8-flash → 3.1-flash-lite), 45 s timeout, retries.
- `agent.ts` — the manual tool loop described above. `pii.ts` masks NID/phone/names.
  `documents.ts` wraps uploaded or retrieved text as data, never instructions.
- `rag.ts` — hybrid keyword + cosine search over `content/laws` and `content/qa.json`
  (Gemini embeddings cached in `law_embeddings`; keyword-only without a key).
- `vision.ts` — deed photo → JSON (schema from zod) → checked in code.

## Front end

- Shell: green government-portal look, original logo, sticky header, phone menu, footer, help button.
- Language: `components/i18n/LangProvider.tsx` — `useLang()`/`<T>`/`<Bi>`; choice in localStorage;
  each component reads the store itself so streamed parts hydrate without mismatch. Engines return
  Bangla and English text side by side.
- Accessibility: axe (WCAG 2.1 AA) clean on 18 pages at 375 px and desktop; visible focus;
  reduced-motion respected.

## Deployment

```mermaid
flowchart LR
  GH["GitHub main"] -->|push| V["Vercel build<br/>region sin1"]
  V --> F["Functions (Node)"]
  F -->|"TLS · session pooler :5432<br/>pool 3 · idle close 2 s"| S["Supabase Postgres<br/>Singapore"]
  F -->|HTTPS| G["Gemini API"]
```

Postgres access goes through Supabase's **session** pooler: postgres.js sends several queries on one
connection at once, which the transaction pooler mixed up (found and fixed on the live site). The
pool is replaced after 10 s idle because serverless instances are frozen between requests.

## Testing

- **Unit** (pure engines, agent loop with a scripted model) and **integration** (real Postgres:
  ledger, RLS, audit tamper tests, G2/G3/G7) — `npm run check`.
- **E2E** — Playwright, one file per golden scenario, plus login/roles, accessibility, English mode,
  judge mode — at 375 px and desktop; `npm run e2e:live` runs the model-independent ones against
  the live site.
- **AI evaluation** — 20 held-out questions on the real model (`npm run eval:ai`, docs/AI_EVAL.md).
