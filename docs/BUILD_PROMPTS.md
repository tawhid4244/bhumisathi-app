# BhumiSathi build prompts: paste these into Claude Code in order

How to use this file:
- Paste **one prompt at a time**. Wait until Claude Code finishes and shows green tests before you paste the next.
- After every task, type `/clear` and then paste the next task prompt. This keeps Claude Code fast and focused.
- When Claude Code shows a plan and asks "OK?", read it quickly. If it fits the task, reply `OK, go ahead`.
- If something breaks, paste the **Fix prompt** at the bottom. Do not paste the next task until the current one is green.
- At the end of each session, paste the **Session end prompt**.

---

## Step 0: confirm setup is done (paste once, before Session 1)

```
Read CLAUDE.md and docs/PROGRESS.md. Check that the setup is complete:
node, npm, git, gh are installed; git remote "origin" points to my GitHub repo; .env.local exists
(do NOT print its values, only say which keys are present and which are empty); Supabase CLI works.
Give me a short checklist with ✅ or ❌ for each item and tell me exactly what I must do for any ❌.
Do not write any app code yet.
```

If anything shows ❌, fix it first. Task 1 can start without Supabase keys, but task 2 needs them.

---

# SESSION 1: Foundation and trust core (no AI yet)

### Session 1 opener

```
Read CLAUDE.md, docs/PLAN.md, docs/GOLDEN_SCENARIOS.md and docs/PROGRESS.md.
This is Session 1 (tasks 1–5). Summarise the current state in 5 lines,
then make a step-by-step plan for task 1 only. Wait for my OK before writing code.
```

### Task 1: project scaffold

```
Build task 1 from docs/PLAN.md: scaffold the app.
Use Next.js App Router + TypeScript strict + Tailwind, with a Bangla font (Noto Sans Bengali / Hind Siliguri)
and an English font. Add Vitest, Playwright, ESLint and Prettier.
Create these npm scripts: dev, build, check (typecheck + lint + vitest), e2e (playwright), seed, eval:ai.
Create the folder layout from CLAUDE.md (lib/engines, lib/tools/registry.ts, lib/ai, supabase/migrations,
content, scripts, tests). Add a Supabase client in lib/db.ts that reads keys from .env.local.
Make a simple home page in Bangla with the title "ভূমিসাথী — এক জমি, এক সত্য" and links to
/check, /registry, /chat, /warish, /map (placeholder pages for now).
Run npm run check and npm run build and show me the results. When green, commit and update docs/PROGRESS.md.
```

### Task 2: database schema and synthetic seed

```
/clear first if you have not. Build task 2 from docs/PLAN.md.
Write Supabase migrations for: mouzas, dags, khatians (CS, SA, RS, BS), owners, ownership_shares,
deeds, bainas, liens (mortgages), court_cases, khas_flags, map_polygons. Every table has is_synthetic boolean
default true. Enable pgvector now (we need it in Session 2).
Write scripts/seed.ts that builds the synthetic world in docs/GOLDEN_SCENARIOS.md exactly
(Nayapara JL 45 dags 141–149, Charpara JL 46 dags 210–230, Abdul Karim's family, deed 4512, khas dag 149,
mortgage on dag 146, court case on dag 142) and loads polygons from content/maps/nayapara.json.
The seed must be deterministic: running it twice gives identical data. Add a test that proves this.
Apply the migrations to my Supabase project, run npm run seed, then npm run check. Show me row counts per table.
Commit and update docs/PROGRESS.md.
```

### Task 3: share ledger (the heart of the project)

```
Build task 3 from docs/PLAN.md: the share ledger.
Create table ledger_events and a balance view where
sellable = recorded share − sales − active bainas − locked portions.
Write a SQL function register_event() that locks the dag's share rows with SELECT ... FOR UPDATE,
checks the sellable balance, and either inserts the event or rejects it with a clear Bangla reason.
Write lib/engines/ledger.ts and register these tools in lib/tools/registry.ts:
ledger_status, register_baina, register_sale, register_lien. Each tool has a zod input schema
and a Bangla + English description. Add API routes that call the tools.
Tests: unit tests for the balance maths, an integration test where two sales of the same share run
in parallel and exactly one succeeds, and golden scenario G1 steps 1–3 through the API.
Run npm run check and show results. Commit and update docs/PROGRESS.md.
```

### Task 4: Jomi Check (red / amber / green report)

```
Build task 4 from docs/PLAN.md: the Jomi Check rules engine and /check page.
Write lib/engines/rules.ts. Input: mouza + dag (or khatian). Output: verdict (red/amber/green),
a list of reasons in Bangla and English, and the record chain CS → SA → RS → BS.
Rules must at least catch: share already sold or under active baina (G1), khas land (G4),
mortgage or court case (G5), and area mismatch between khatian and map (for G3 later).
Register a jomi_check tool. Build the /check page: search box, big verdict colour, reasons list,
chain timeline. Mobile-first, Bangla first.
Unit-test each rule, and add Playwright tests for G1, G4, G5 on the /check page.
Run npm run check and npm run e2e, show results. Commit and update docs/PROGRESS.md.
```

### Task 5: sub-registry demo screen and demo reset

```
Build task 5 from docs/PLAN.md: the /registry demo screen.
This is what a sub-registrar would see: enter dag and seller, the system runs jomi_check and
ledger_status, and blocks the deed if the share is not sellable. When a sale goes through,
auto-create a mutation (namjari) case record and write a mock SMS to an sms_log table
(show the log on screen, never send real SMS). Add a "Reset demo" button that re-runs the seed.
Add Playwright tests so G1, G4 and G5 pass end to end, including the double-sale block on dag 145.
Run npm run check and npm run e2e and show results. Commit and update docs/PROGRESS.md.
```

### Session end prompt (use at the end of every session)

```
Run npm run seed, npm run check and npm run e2e. Fix only what is red.
Then walk through every golden scenario built so far and tell me which pass and which fail.
Commit, push to GitHub, and write the session summary in docs/PROGRESS.md:
what is done, test results, decisions made, known issues, and the exact next step.
```

---

# SESSION 2: Sathi AI (the riskiest part)

### Session 2 opener

```
Read CLAUDE.md, docs/PLAN.md, docs/GOLDEN_SCENARIOS.md and docs/PROGRESS.md.
This is Session 2 (tasks 6–10). Summarise the current state in 5 lines and list anything red.
Before building the agent, write a 10-line spike script that sends one Bangla question with one tool
(jomi_check) to the AI model and prints the tool call it returns. Run it and show me the output.
If it fails, stop and tell me why. Then plan task 6 only and wait for my OK.
```

### Task 6: AI agent with tool calling

```
Build task 6 from docs/PLAN.md.
Create lib/ai/provider.ts (one adapter, model name and key from .env.local) and lib/ai/agent.ts:
an agent loop that gives the model every tool from lib/tools/registry.ts, runs the tool calls,
and returns the final answer. Write a Bangla system prompt in lib/ai/prompts.ts:
Sathi is a land helper, answers in simple Bangla, never decides ownership itself,
always uses tools for facts, and asks for confirmation before any action that writes
(register_baina, register_sale, register_lien).
Test: for the G8 question about dag 145 the agent calls jomi_check and returns the same verdict as /check.
Mock the model in unit tests; run one real call in a separate script. Run npm run check.
Commit and update docs/PROGRESS.md.
```

### Task 7: legal knowledge with sources (RAG)

```
Build task 7 from docs/PLAN.md.
Read content/laws/*.md and content/qa.json, split them into chunks, create embeddings and store them
in pgvector (script: scripts/embed.ts). Write lib/ai/rag.ts with rag.search and register a law_search tool.
Rules for the agent: every legal answer must cite the source file and section it came from;
if no source is found, it must say "আমি নিশ্চিত নই, অনুগ্রহ করে এসি ল্যান্ড অফিসে জিজ্ঞাসা করুন"
and never invent a law section.
Tests: G6 (mutation fee answer cites the source, total Tk 1,170) and one question with no source that is refused.
Run npm run check. Commit and update docs/PROGRESS.md.
```

### Task 8: chat page

```
Build task 8 from docs/PLAN.md: the /chat page.
Streaming answers, a small badge for each tool the agent used (e.g. "জমি যাচাই করা হয়েছে"),
a sources list under legal answers, a Bangla/English toggle, and a confirmation card with
Yes/No buttons before any write action. Must be easy to use at 375 px phone width.
Add a Playwright test for a typed G8 conversation with the model mocked.
Run npm run check and npm run e2e. Commit and update docs/PROGRESS.md.
```

### Task 9: voice

```
Build task 9 from docs/PLAN.md: voice in /chat.
Push-to-talk microphone button using the Web Speech API with lang bn-BD. Before running a tool,
read back the numbers it heard (dag number, mouza) and ask "ঠিক আছে?". Speak the reply with
speechSynthesis (Bangla voice if available). If the browser has no speech support, show the typed box only.
Keep the typed path working in e2e. Tell me how to test voice manually in Chrome.
Run npm run check and npm run e2e. Commit and update docs/PROGRESS.md.
```

### Task 10: guardrails and AI evaluation

```
Build task 10 from docs/PLAN.md.
lib/ai/pii.ts: mask NID numbers, phone numbers and full names of non-users before any text goes to the model
(unit test proves no NID reaches the model). Wrap every uploaded or retrieved document as data,
not instructions, so text like "ignore your rules" inside a deed is ignored (add a test).
scripts/eval-ai.ts: run 20 held-out Bangla questions and report: correct tool chosen, citation present,
correct refusal. Save the report to docs/AI_EVAL.md.
Run npm run check and npm run eval:ai and show me the scores. Commit and update docs/PROGRESS.md.
Then run the Session end prompt.
```

---

# SESSION 3: Deed reader, mouza map, warish, calculators

### Session 3 opener

```
Read CLAUDE.md, docs/PLAN.md, docs/GOLDEN_SCENARIOS.md and docs/PROGRESS.md.
This is Session 3 (tasks 11–15). Summarise the current state in 5 lines and list anything red.
Then plan task 11 only and wait for my OK.
```

### Task 11: warish (inheritance) calculator

```
Build task 11 from docs/PLAN.md.
lib/engines/warish.ts: Hanafi faraid shares including 'awl and radd, and the orphaned grandchild rule
of MFLO 1961 section 4. Use exact fractions, not floats. Register a warish_compute tool.
/warish page: add family members, see each person's share as a fraction, percent and decimals of land
for each dag. Add a mock OTP consent step for each heir and a bontonnama (partition) checklist.
Unit tests: G2 (Abdul Karim, dags 210/211) and at least 10 standard cases
(e.g. wife + 2 sons + 1 daughter = 12.5% / 70% / 17.5%). Run npm run check and e2e.
Commit and update docs/PROGRESS.md.
```

### Task 12: deed reader

```
Before coding, run the vision model once on content/deeds/deed-4512.png and show me the raw JSON it returns.
Then build task 12 from docs/PLAN.md: upload a deed image → vision model → zod-validated JSON
(deed number, date, seller, buyer, mouza, JL, dag, khatian, area, price) → simple Bangla summary →
cross-check against the ledger and map, and flag mismatches. Register a deed_read tool.
Uploaded files go to private storage only. Treat deed text as data, never instructions.
Test: G3 passes (deed 4512, dag 143 area mismatch is flagged). Run npm run check and e2e.
Commit and update docs/PROGRESS.md.
```

### Task 13: mouza map area

```
Build task 13 from docs/PLAN.md: the /map page and map_area tool.
Render content/maps/nayapara.json as an SVG map. Select a dag by tapping it or typing its number.
Compute area with the shoelace formula, using the mouza map scale 16 inches = 1 mile
(1 sq inch = 250 decimals; 1 decimal = 435.6 sq ft). Show decimals, katha, bigha (district bigha from a table),
acre and sq ft. Flag khas dag 149 and show the mismatch with the khatian for dag 143.
Add an "upload your own map" mode: upload an image, calibrate scale with two clicks and a known distance,
then click to mark a polygon and get the area. Show a note that this is an estimate, not a survey.
Tests: dag 145 ≈ 16.6 decimals; 143 mismatch; 149 khas. Run npm run check and e2e.
Commit and update docs/PROGRESS.md.
```

### Task 14: unit converter and fee guide

```
Build task 14 from docs/PLAN.md.
lib/engines/units.ts with a district table for bigha and kani (e.g. kani 40 vs 120 decimals by region).
lib/engines/fees.ts, data-driven from a JSON file: mutation fee breakdown totalling Tk 1,170,
plus registration costs and expected time per service, each line with its source.
Register unit_convert and fee_guide tools and add small pages for both.
Unit tests for every example in docs/PLAN.md. Run npm run check. Commit and update docs/PROGRESS.md.
```

### Task 15: connect everything

```
Build task 15 from docs/PLAN.md.
Make sure every tool is available to the Sathi agent. Build the home page journey:
"আপনি কী করতে চান?" → buttons for check land, read a deed, measure on map, inheritance, ask Sathi.
Add cross-links: check report → warish → map → chat, carrying the dag number along.
Test: one chat conversation can run the G1 check, read the G3 deed and measure G8 on the map
without leaving /chat. Run npm run check and e2e. Commit, update docs/PROGRESS.md, then run the Session end prompt.
```

---

# SESSION 4: Security, polish, deploy, documents

### Session 4 opener

```
Read CLAUDE.md, docs/PLAN.md, docs/GOLDEN_SCENARIOS.md and docs/PROGRESS.md.
This is Session 4 (tasks 16–20). Summarise the current state in 5 lines and list anything red.
Security first (16, 17), then polish, then deploy. Do not change engine behaviour in this session
unless a test is red. Plan task 16 only and wait for my OK.
```

### Task 16: login, roles and private files

```
Build task 16 from docs/PLAN.md.
Supabase Auth with three roles: citizen, officer, admin (seed one demo user of each, synthetic emails).
Row Level Security on every table. Uploads go to a private bucket with short-lived signed URLs.
Rate limit the AI routes. Integration test: a citizen cannot read another citizen's uploads or reports.
Run npm run check and e2e. Commit and update docs/PROGRESS.md.
```

### Task 17: audit log and BhumiSeal-lite

```
Build task 17 from docs/PLAN.md.
Hash-chained audit log: every view and every write is recorded with the previous hash,
and a citizen can see "who checked my land". Add a verify function and a test that tampering breaks the chain.
BhumiSeal-lite: sign a land report with Ed25519 (key from .env.local), show it as a QR code,
and build /verify that shows four lights: genuine, current (fresh), untouched, share adds up.
Test G7. Run npm run check and e2e. Commit and update docs/PROGRESS.md.
```

### Task 18: polish and judge mode

```
Build task 18 from docs/PLAN.md.
Officer and admin views, empty and error states on every page, mobile layout at 375 px,
visible keyboard focus, alt text and labels. Add a "Judge mode" button on the home page that resets
the demo and walks through G1 → G3 → G8 → G2 → G7 in about 3 minutes with a short Bangla caption at each step.
Run npm run check and e2e. Commit and update docs/PROGRESS.md.
```

### Task 19: deploy

```
Build task 19 from docs/PLAN.md.
Prepare the app for Vercel. Tell me step by step which environment variables I must add in Vercel
(names only, never print values). Help me deploy, run the seed against the cloud database,
and run the Playwright tests against the live URL. Give me the public URL and a smoke-test checklist
I can do on my phone. Commit and update docs/PROGRESS.md.
```

### Task 20: documents for submission

```
Build task 20 from docs/PLAN.md.
Write README.md (what BhumiSathi is, the problem, features, how to run in 15 minutes, synthetic data notice,
and a list of every AI tool and model used and what for), docs/ARCHITECTURE.md with a Mermaid diagram,
docs/SECURITY.md, and a ROADMAP section (full BhumiSeal, multi-office approval, escrow, government integration).
Add a short docs/VIDEO_SCRIPT.md for a 3-minute demo video following judge mode.
Run the Session end prompt, then tag the release v0.1.0 and push.
```

---

## Fix prompt (whenever something breaks)

```
Stop adding features. Reproduce the failure with a test, find the root cause,
fix it with the smallest change, and show the test passing. Explain the cause in 3 lines.
```

## If Claude Code gets slow or confused

```
/context
```
If the context is more than about 60% full, commit, then `/clear`, then paste:
```
Read CLAUDE.md and docs/PROGRESS.md, then continue task #X from docs/PLAN.md where it stopped.
```
