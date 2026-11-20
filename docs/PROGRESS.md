# Progress log (handover between sessions)

Update at the end of every task and at the end of every session. Newest entry first.

## Status

| Session | Tasks | State |
| --- | --- | --- |
| 1 | 1–5 | done (2026-11-14) |
| 2 | 6–10 | done (2026-11-15), verified on real Gemini |
| 3 | 11–15 | done (2026-11-15) |
| 4 | 16–20 | done (2026-11-16), v0.1.0 tagged |
| 5 | Phase A of LAND_SERVICES_PLAN (AI speed + voice accuracy) | done (2026-11-17) |
| 5 | Phase B (application framework, My services, sandbox payment, signed copies) | done (2026-11-17), live |
| 5 | Phase C (mutation, land tax + dakhila, complaints; G9–G11) | done (2026-11-17) |

## Golden scenarios

| G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | G9 | G10 | G11 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pass | pass | pass (real Gemini vision) | pass | pass | pass (real Gemini) | – | pass (typed on real Gemini; voice e2e with fake speech; manual mic test pending) | pass | pass | pass (chat with mock model) |

## Entries

### 2026-11-20 — MCP server for other AI agents
- Done: `lib/mcp/server.ts` + `npm run mcp` (stdio). Offers the 10 public read tools from the same
  registry; ledger writes, login-only tools and deed uploads are never listed and are refused if
  called. Every call goes through `runTool` as an anonymous caller (validation, roles, audit log).
  Docs: `docs/MCP.md` (Claude Desktop setup).
- Tests: `npm run check` green (296); `tests/integration/mcp.test.ts` uses a real MCP client;
  stdio smoke test: 10 tools listed, `jomi_check` dag 142 → red.
- Next step: optional Streamable HTTP transport so remote agents can connect without a local copy.

### 2026-11-17 — Session 5, Phase C: mutation, land tax, complaints (G9–G11)
- Done (plan: docs/LAND_SERVICES_PLAN.md services #1, #2, #9), all on the Phase B framework:
  - Migration `0008_phase_c.sql`: states `hearing` and `final_payment_due`; `hearings`; ledger event
    type `mutation`; `approve_mutation(deed)` — one transaction with the dag row locked: seller's BS
    share down, a new BS khatian for the buyer, deed no longer "unmutated", mutation case approved,
    dag version bumps (old seals turn superseded), buyer inherits the tax status, mock SMS to both.
    Demo reset now also clears service applications (they point at the rebuilt land records).
  - **Mutation** (MUT): apply with the deed number (seller, buyer, dag, area come from the deed;
    one open application per deed) → Tk 70 → hearing (notice + SMS) → AC Land order →
    DCR Tk 1,100 → new khatian document. Fees from content/fees.json, in two stages.
  - **Land tax** (LDT, `lib/engines/land-tax.ts`, `content/land-tax.json`): years due per holder
    since the last paid fiscal year; farmland up to 25 bigha exempt (from news reports of the 2023
    Act); non-agricultural rates are the 1976 schedule's examples, labelled NOT verified (the
    government's rate pages returned 404 on 2026-11-17). Pay in the sandbox or, when exempt, take
    the dakhila at once; signed dakhila verifies "current" only while it covers this fiscal year.
    `/land-tax`: "tax on my land" for linked accounts + lookup for any dag.
  - **Complaints** (CMP, `lib/engines/complaints.ts`): rule-based triage (category, urgency,
    amount, service, dag) of the citizen's words; money/broker complaints urgent (3 days);
    anonymous complaints hide the name even from the office; officer must write what was done;
    `/complaints` monthly counts only. Link from `/fees` ("someone asked for more?").
  - Sathi AI: `complaint_submit` (the one citizen write it may propose — stops at the confirmation
    card), `land_tax_due`, `application_status`; prompt lines; mock model flows for tests.
  - UI: mutation form, complaint form, land-tax page, complaints page; application page renders
    every type (hearing, two-stage fees, complaint text, dakhila / mutation khatian with QR);
    officer inbox shows urgent first, hearing dates, type-specific buttons.
- Tests: npm run check green (291). npm run e2e 234/234 (+ phase-c.spec: G9, G10, G11 by chat,
  anonymous complaint; mobile + desktop). Integration `phase-c.test.ts` covers G9–G11 on the DB.
- AI eval after Phase C (real Gemini, 2026-11-17): tool 90%, verdict 83%, citation 88%, refusal 100%,
  write 100%, false "not sure" 0%. The two misses: E03 hit the free-tier quota (429, not a wrong
  answer); E12 answered without law_search once and passed on re-run. The main Gemini models
  returned 503 for most of the day; officer write requests now fall back to the quick model.
- Known issues: non-agricultural tax rates unverified (labelled); inheritance/partition mutation
  not yet (sale only); complaint triage is rule-based on forms (the model picks it in chat).
- Next step: Phase D (records & maps, revenue cases, acquisition, information bank, map layers).

### 2026-11-17 — Session 5, Phase B: shared application framework
- Done (plan: docs/LAND_SERVICES_PLAN.md Part 2 "shared foundation"):
  - Migration `0007_applications.sql`: applications (numbers like `CPY-2026-0001`), application_events
    (timeline), payments (SANDBOX only, `SBX-…` receipts), issued_documents, notifications; RLS: a citizen
    reads only their own rows, officers/admins all; the engine is the only writer.
  - `lib/services/catalog.ts`: the 11 services of "Bhumi shathi.docx" with what is open now and the
    phase for the rest; application type `certified_copy` (fee from content/fees.json: 100 + 40 post).
  - `lib/engines/applications.ts`: state machine payment_due → in_review → completed / rejected
    (+ cancelled); every step in the timeline, the hash-chained audit log and the bell.
  - `lib/engines/documents.ts`: signed documents `BD1.…` (same Ed25519 key as BhumiSeal); four lights:
    genuine, on record, untouched, current. `lib/adapters/payment.ts`: sandbox gateway (no money).
  - Tools: application_submit / status / track / pay / cancel / inbox / decide, document_verify,
    document_qr, notifications. Only application_status is offered to Sathi AI ("where is my application?");
    every other write is the citizen's or officer's own click.
  - Pages: `/services` (catalogue), `/services/apply/certified_copy` (3-step wizard), `/my` (My services:
    applications with progress steppers, notifications), `/my/applications/[no]` (tracker, sandbox payment,
    printable signed copy with QR), `/track` (public, status only), `/inbox` (officer, SLA badges),
    `/verify/doc`. Header: "Services" in the menu; account menu has My services (unread count) and Inbox.
  - Fix: header menu and help button now sit inside Suspense (dynamic pages read the URL later).
  - `npm run cloud:migrate`: applies new migrations to the cloud without reseeding.
- Tests: npm run check green (287: + services unit, applications integration incl. RLS and forgery).
  npm run e2e 226/226 (+ services.spec: apply → pay → officer approves → copy verifies green; other
  citizen blocked; unknown dag; sign-in redirects; citizen kept out of the inbox). One run logged a single
  hydration warning that did not repeat on the next full run.
- Cloud: migration 0007 applied with `npm run cloud:migrate`. Its first run printed a unique-key error:
  `scripts/migrate.ts` started its own command-line block too (its check `endsWith("migrate.ts")` also
  matched "cloud-migrate.ts"), so two migrations ran at once; one applied 0007, the other failed and rolled
  back. Fixed: the check now matches the exact file name.
- Next step: Phase C (mutation, land tax, complaints) on this framework.

### 2026-11-17 — Session 5, Phase A: Sathi AI speed and voice accuracy
- Done (plan: docs/LAND_SERVICES_PLAN.md Part 1):
  - **Fast path** (`lib/ai/intent.ts`, `lib/ai/fast-answers.ts`, `runAgent({ fastPath })`): "check dag N",
    "area of dag N" and "X kani Y gonda = ? decimals" are detected in code and answered from the same tools
    (through `execute()`, so role checks and the audit log still apply) with a fixed Bangla/English
    template. No model call. Legal, fee, write, inheritance and "why" questions still go to the model.
    Several mouzas with that dag → asks which; unknown dag → says so. Only the chat API turns it on.
  - **Bangla number words** (`lib/ai/bn-numbers.ts`): "একশো পঁয়তাল্লিশ নম্বর দাগ" → 145; সাড়ে/দেড়/আড়াই;
    a lone word ("নয়" = not) is converted only next to a land word. Unicode য়/ড়/ঢ় spellings normalised.
  - **Mouza close-spelling match** ("নয়াপারা", "Nayapaara" → Nayapara), edit distance 1–2 for long names.
  - **jomi_check and map_area work without a mouza** (`mouzaFor`): the tool finds the only mouza with that
    dag, or its error lists them; saves the model a find_dag round trip.
  - **Gemini**: quick model `gemini-3.1-flash-lite` tried first on every step (`AI_ROUTER_MODEL`,
    "" = off; `AI_ROUTER_STEPS=tools` = only tool-choosing steps), main model kept as fallback and for
    officer write requests (`ChatRequest.careful`). Minimal thinking (`AI_THINKING`; models that refuse
    MINIMAL step up to LOW automatically). Answers **stream** (`generateContentStream`), text reaches the
    citizen as it is written; no model switch after text has been shown. Quick model must start within
    8 s, larger fallbacks within 25 s.
  - **PII fix**: small models sometimes drop the brackets of `[ব্যক্তি-১]`; unmask now accepts both, so
    find_person gets the real name (this broke the officer sale flow on flash-lite).
  - **Voice**: 5 speech alternatives, the one with a dag number wins over a mis-heard top guess; number
    words become digits before the read-back. The read-back before any action stays (hard rule).
  - Prompt: fees → law_search + fee_guide together; partition (বণ্টন) is a law question; one-line refusal
    for bribes/forgery and for non-land questions.
- Measured (`npm run ai:latency`, real Gemini, local DB) for "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও":
  before **70.2 s** (3 calls of 20–27 s) → model path **3.7 s** (first text 3.2 s) → fast path **0.02 s**.
  Fee question 4.8 s, baina law question 4.5 s.
- AI eval (`npm run eval:ai`, 20 held-out questions): tool 100%, verdict 100%, citation 100%, refusal 100%,
  write held 100%, false "not sure" 0%, errors 0 (before: 95 / 83 / 100 / 100 / 100 / 0).
- Tests: npm run check green (279 tests: + bn-numbers, intent, gemini-stream, voice, pii, fast-path
  integration). npm run e2e green 216/216 (375 px + desktop).
- Known issues: free-tier quota — `gemini-3.5-flash` returned 429 after several eval runs today; the quick
  model carries the load and the chain falls back as before. Real microphone test still pending.
- Next step: Phase B (shared application framework + My services + mock payment + signed documents).


### 2026-11-16 — Session 4 summary (tasks 16–20 done) · release v0.1.0
- Done:
  - Task 16 identity, roles, RLS, private uploads, rate limits, CSRF. Task 17 hash-chained audit
    log, "who checked my land", BhumiSeal-lite + /verify (G7). Task 18 office/admin view, judge
    mode, accessibility pass. Task 19 deploy (Vercel sin1 + Supabase Singapore), live-only bugs
    fixed (session pooler, sign-in loop, login before scripts load). New look with original logo
    and Bangla/English for every screen.
  - Task 20 documents: README.md (problem, features, demo accounts without password, run in about
    15 minutes, every AI model/tool and what for, roadmap), docs/ARCHITECTURE.md (Mermaid
    diagrams: system, agent sequence, deployment), docs/SECURITY.md (threats, controls with the
    tests that prove them, known gaps), docs/VIDEO_SCRIPT.md (3-minute judge-mode script, Bangla
    narration + English subtitles). docs/AI_EVAL.md now states the last full-run scores.
    `.env.example` AI comment corrected.
- Golden scenarios: G1 ✅ G2 ✅ G3 ✅ G4 ✅ G5 ✅ G6 ✅ (real Gemini) G7 ✅ G8 ✅ (typed on real Gemini;
  voice with a fake speech engine in tests — the real microphone is a manual check,
  docs/VOICE_TESTING.md).
- Tests: npm run seed OK; npm run check 231/231; npm run e2e 216/216 (375 px + desktop, 0 hydration errors); live e2e 82/82 (last run).
- Decisions: documents quote the last full AI evaluation instead of spending free quota on a re-run;
  demo password never written in any document.
- Known issues: nonce CSP deferred; law summaries and some fees await mentor review; free Supabase
  pauses after a week idle; GitHub repository is still PRIVATE (must be made public for submission
  — the owner's decision).
- Next step: make the repository public; record the video with docs/VIDEO_SCRIPT.md; test the
  real microphone on a phone; submit.

### 2026-11-16 — Session 4, English mode for every tool screen
- Done: the বাং | EN switch now covers every screen, not only the shell and home: report,
  sub-registry desk, chat (follows the site switch), inheritance, deed reader, mouza map and the
  measuring tool, units, fees, verify, my-land, office/admin, judge mode, login, error and 404.
  Engines return English alongside Bangla: warish `steps_en`/`basis_en`, deed `summary_en`, unit
  labels and rules, fee times/conditions/cost parts (content/fees.json, units.json), seal light
  explanations, audit role/action labels, verdict `advice_en`, judge card titles/lines (the AI step
  asks and answers in English). Names come from `name_en` where the records have it; citizens' SMS
  text stays Bangla (it is what they would receive).
- Fixed: hydration mismatch when parts of a page stream in after the language switch (the account
  menu): `useLang` now reads the store per component (useSyncExternalStore), so each part hydrates
  with the server's Bangla and then switches. Removed the unused ComingSoon component.
- Tests: check 231/231 (new English engine tests); e2e english.spec (no Bangla in headings in
  English mode) + full suite at 375 px and desktop; zero hydration errors in the run.
  Live: English mode checked on bhumisathi-app.vercel.app (report, fees, home, warish; no page
  errors); live e2e 82/82.
- Next step: the user's UI references (if any) → design pass; task 20 (submission documents).

### 2026-11-15 20:30 — Session 4, task 19 (deploy) + new look
- Live: https://bhumisathi-app.vercel.app (Vercel, Singapore `sin1`) on Supabase Postgres 17
  (Singapore). `/api/health` reports settings present (yes/no only), database and seal key.
- Deploy work: uploads stored in Postgres (RLS); `0006_cloud_ready.sql` revokes everything from
  Supabase's `anon`/`authenticated` (tables, views, functions, defaults) — verified on the cloud
  DB; seed CLI split so the app never bundles the local Postgres binary; TLS to the cloud DB;
  scripts `set-db` (hidden input), `cloud:setup`, `vercel:env`, `vercel:push-env`, `e2e:live`;
  docs/DEPLOY.md. Every push to main deploys automatically.
- Live-only bugs found and fixed (all reproduced first, then fixed):
  1. Pages that read the DB hung: postgres.js pipelines queries; Supabase's TRANSACTION pooler
     (6543) loses or mixes up results (one request even got another query's rows). The app now
     always uses the SESSION pooler (5432), pool 3, idle connections closed after 2 s, pool
     replaced after 10 s idle (performance.now — Date.now is not allowed while Next prerenders).
  2. Sign-in sent people back to /login: the production router had prefetched /chat while signed
     out (a redirect) and reused it after login. Login/logout now do a full page load.
  3. The login form had no method: a press before scripts loaded would have sent a GET with the
     password in the address. It now always POSTs; the API also accepts form posts and redirects.
- New look (user request): original logo (sunrise over paddy fields, a plot divided into shares,
  verified tick; favicon too; no government emblem). Bangla/English switch for the whole site
  (remembered per browser). Government-portal layout: flag-green strip, prototype notice, sticky
  header with menu + active page, phone menu panel, account menu, green footer, floating "Ask
  Sathi". Home: hero with quick dag check and original illustration, pausable notice ticker,
  animated numbers, tabbed service cards, how-it-works, hands-on ledger demo, FAQ, 16122 card.
  Inner pages: green title band with breadcrumb. Reduced motion respected. The measuring map
  now always fits below the sticky header (corners could hide under it on laptops).
- Tests: check 228/228; local e2e green at 375 px and desktop (incl. axe on 18 pages, language
  switch, ledger demo, quick check, login before scripts load); live e2e 82/82
  (`npm run e2e:live`, phone width; mock-only chat tests and the judge tour excluded).
- Known issues: English mode covers the shell, home and page titles; text inside the tools
  (reports, chat, forms) is still Bangla-first with English lines. Waiting for the user's design
  references for the next UI pass. Cloud audit log has one "debug_probe" entry from testing
  (cleared by the next demo reset). Free Supabase projects pause after a week without traffic.
- Next step: user's UI references → second UI pass; then task 20 (README, ARCHITECTURE,
  SECURITY, VIDEO_SCRIPT, tag v0.1.0).

### 2026-11-15 16:45 — Session 4, task 18 (office/admin view, judge mode, accessibility)
- Done:
  - **Judge mode** (`/judge`, big button on the home page, no account needed): resets the demo and
    plays nine steps, G1 baina → G1 double sale blocked → G1 honest sale → G3 deed → G8 Sathi AI →
    G2 warish → G7 seal (green) → G7 superseded (amber), each with a Bangla + English caption,
    the result and a "see it yourself" link. Auto-advances every 18 s (≈3 min); pause and "পরের ধাপ".
    Security: the browser sends only a step number; every action is fixed in `lib/demo/judge.ts`
    (fixed dags, people, areas); writes run as a scripted demo officer and are audited; the visitor
    never gets an officer/admin session. Rate limited per IP (60 steps, 6 resets a minute);
    `JUDGE_MODE=off` or `DEMO_RESET_DISABLED=true` switches it off.
  - **Office view** (`/admin`): officers see tiles (dags, registered/blocked transactions, pending
    mutations, seals, audit entries), the audit chain status, pending mutation cases and the
    latest audit entries (roles only). Admins also see the accounts (never password hashes) with
    "unlock" for locked accounts (`/api/admin/unlock`, audited) and the demo reset.
    The user bar links officers to "অফিস" and land holders to "আমার জমি".
  - Bangla `not-found` and `error` pages (no technical details shown; digest only).
  - Accessibility pass: `@axe-core/playwright` over 18 pages (incl. a report, a map, warish, 404)
    at 375 px and desktop: no serious/critical WCAG 2.1 A/AA problems, no sideways scroll, keyboard
    focus visible (3 px outline). Every existing page already passed; new pages built to the same rules.
- Tests: integration `judge-office.test.ts` (all nine steps with the expected verdicts on the mock
  model; scripted writes audited; chain intact; office view hides identities; no password hashes).
  e2e `a11y.spec.ts`, `judge-admin.spec.ts`.
  Results: npm run check green (225 unit + integration), build green, e2e 192/192 (mobile + desktop).
- Decisions: in the tour G8 runs after G1, so Sathi correctly answers RED for dag 145 (nothing left
  to sell); the caption says so. On a shared deployed site two judges at once share one demo world.
- Known issues: judge mode on the real Gemini key uses two model calls (deed + chat) of the free quota
  per run; if the quota is used up, that step shows a message and the tour continues.
- Next step: task 19 (deploy: Vercel + Supabase/cloud Postgres; secrets in the host's store; SITE_URL).

### 2026-11-15 15:30 — Session 4, task 17 (audit log + BhumiSeal-lite, G7)
- Done:
  - **Hash-chained audit log** (`0005_audit_seal.sql`, `lib/engines/audit.ts`): every view and write
    made through a tool by a request (pages, API, Sathi AI) appends one entry; refused write attempts
    too. body = canonical JSON {at, actor, role, action, dag_id, detail}; hash = sha256(prev + body);
    first entry links to 64 zeros. `append_audit()` takes a lock, so the chain never forks, and fills
    the columns FROM the hashed body. `verifyAuditChain()` checks links, hashes, and that columns match
    the body (finds the first broken entry and why). Audit is fail-closed: no entry, no answer.
    /check and /map page views now go through the tools, so they are logged too.
  - **Who checked my land** (`/my-land`, tool `who_checked`): a citizen account can be linked to a
    land holder (`users.owner_id`; demo citizen = Anwar Hossain, holder of dag 141). RLS shows a
    citizen only entries for dags they hold; the actor and body columns are not granted to app_user,
    so viewers appear by role only ("লগইন ছাড়া একজন দর্শক", "সাব-রেজিস্ট্রি কর্মকর্তা"). Officers
    see the chain status (tool `audit_status`).
  - **BhumiSeal-lite** (`lib/engines/seal.ts`): `BS1.<payload>.<Ed25519 signature>`; the payload holds
    mouza, JL, dag, area, verdict, holders (recorded + sellable), ledger_version, issue time, key id.
    Key: `SEAL_PRIVATE_KEY` (generated by `npm run users`); public key at `/api/seal/key`.
    Issuing is logged (seal id + payload hash). QR (`qrcode` package, SVG) points to
    `SITE_URL/verify#code` — the code is after "#", so it never reaches server logs.
  - **/verify** shows four lights: genuine (signature), current (ledger version unchanged; counts
    new events), untouched (issue found in the audit log and the chain intact), shares add up
    (holders' shares = dag area, nobody oversold). Overall: green GENUINE + CURRENT, amber
    SUPERSEDED / warning, red NOT GENUINE. No account needed to verify; issuing needs a citizen login.
  - The /check report has a "সিলযুক্ত রিপোর্ট নিন" panel (QR, verify link, code). Home links to
    /verify and /my-land. `seal_issue` is hidden from Sathi AI (its output is a QR image).
- Tests: integration `audit-seal.test.ts` (13): views/writes logged, scripts not logged, denied
  writes logged, tamper tests (edit column → fields, edit body → hash, delete → link), G7 all four
  steps, missing/broken log → not untouched, who-checked by role + RLS. e2e `g7-seal.spec.ts`.
  Results: npm run check green (221 unit + integration), build green, e2e 144/144 (mobile + desktop).
- Decisions: the audit log is part of the demo world, so "Reset demo" empties it (old seals then
  show "untouched: not found"). Viewer names are never shown to land holders, only roles.
- Known issues: the demo reset also restarts the chain (a real deployment would never truncate it).
- Next step: task 18 (officer/admin views, empty and error states, 375 px, accessibility, judge mode).

### 2026-11-15 14:00 — Session 4, task 16 (identity, roles, RLS, rate limits)
- Done:
  - **Accounts and sessions on Postgres** (Supabase keys are still empty, so no Supabase Auth yet):
    migration `0004_auth_rls.sql` adds `users`, `sessions`, `uploads`, `rate_limits`.
    Passwords: scrypt N=2^17, r=8, p=1 (OWASP), min 12 chars, constant-time compare, same timing
    for unknown emails. Sessions: random 256-bit token in an httpOnly, SameSite=Lax cookie
    (`__Host-bs_session`, Secure, in production); only its SHA-256 is stored; 8 h expiry; logout
    deletes the row. Lockout: 5 wrong passwords → 15 min. One error message for wrong email or password.
  - **Roles, least privilege:** public (land check, laws, warish, map, units, fees) < citizen
    (Sathi AI, deed reader, ledger status, find person) < officer (register sale/baina/mortgage,
    /registry, demo activity) < admin (demo reset). Each tool has `access`; `runTool` now REQUIRES
    a caller context and refuses with 401/403. The agent only shows the model the tools the user's
    role allows, so a forged "pending sale" in a citizen's chat history is refused too.
  - **Row Level Security on every table** (deny by default). Requests that touch user data run as
    the restricted role `app_user` with the user id set per transaction (`lib/auth/db.ts`).
    `app_user` can read land records but never NID/phone columns, accounts or sessions;
    ledger events, SMS and mutation cases are officer-only.
  - **Private uploads:** each deed upload is owned by the uploader (RLS insert/select policies).
    `deed_read` checks ownership through RLS before any model sees the image; another citizen gets
    "not found". Upload responses include a 5-minute HMAC-signed link bound to the file AND the user
    (`/api/uploads/{id}`).
  - **Rate limits** (Postgres, fixed window, works across instances): Sathi AI 15/min and 300/day
    per user; uploads 10/min per user; login 10/min per IP.
  - **CSRF:** `proxy.ts` refuses state-changing `/api` requests marked cross-site (Origin /
    Sec-Fetch-Site), on top of SameSite cookies. Login `next=` only allows our own paths.
  - UI: `/login` (Bangla first), user bar with name + role + logout on every page; /chat and /deed
    ask visitors to sign in; /registry is officers only; the Reset button is admin only.
  - Demo accounts (synthetic, `.test` emails): one citizen, a second citizen, officer, admin.
    `npm run users` generates `AUTH_SECRET` and `DEMO_USER_PASSWORD` into .env.local (never printed)
    and creates the accounts. Demo reset never touches accounts.
- Tests: unit `auth.test.ts` (scrypt, roles, safe redirect, signed links), registry and agent role
  tests; integration `auth-rls.test.ts` (citizen cannot read another citizen's upload; officer can;
  raw RLS queries; NID/phone/users/sessions denied; RLS on 100% of tables; login, logout, lockout;
  rate limit) and ledger API 401/403. e2e: a `setup` project logs in once per role; new
  `auth.spec.ts`; the rest run as officer, demo reset as admin.
  Results: npm run check green (208 unit + integration), build green, e2e 132/132 (mobile + desktop).
- Decisions: own sessions instead of Supabase Auth until Supabase is linked (same RLS model works
  there: `app_user_id()` can read `auth.uid()` later). Officer-only writes also from chat: a citizen's
  Sathi can check and explain but not record. The e2e test server allows 60 logins/min per IP.
- Known issues: strict nonce CSP still deferred; signed links are not yet shown in the UI (previews
  are made in the browser from the chosen file).
- Next step: task 17 (hash-chained audit log, BhumiSeal-lite, /verify, G7).

### 2026-11-15 12:30 — Session 3 summary (tasks 11–15 done)
- Done: warish calculator (G2), deed reader (G3), mouza map + measure-your-own-map, unit converter
  with regional kani sizes, fee guide, and everything connected.
- Task 15: home page "আপনি কী করতে চান?" with all 8 services (Sathi first). Cross-links carrying the
  dag: /check "এরপর কী করবেন" → ম্যাপে দেখুন (/map?mouza=…&dag=… opens that dag), ওয়ারিশ হিসাব
  (shown when the recorded owner has died; /warish?owner=… preselects the land), সাথীকে জিজ্ঞাসা
  (/chat?q=… pre-fills, not sent), দলিল যাচাই. Chat 📎 attaches a deed photo (private upload; the model
  gets "(upload_id: …)", the bubble shows "📎 দলিলের ছবি"); prompt tells Sathi to call deed_read.
  PII: digit runs inside ids/codes are no longer masked; all title spellings of a person (মোঃ / মো: /
  মো. / মোহাম্মদ / Md) share one placeholder — fixes "মো: মোঃ রহিম উদ্দিন" seen in the real run.
- Tests: `npm run seed` OK; `npm run check` green (185); `npm run e2e` green (112, phone + desktop),
  incl. journey.spec (one /chat conversation: G1 red → 📎 deed G3 amber "আমিন" → map ≈20.04 dec;
  check → map / warish / chat links); integration test of the same one-conversation flow with real
  tools. Build green. REAL Gemini: the same 3-turn conversation works (find_dag → jomi_check,
  deed_read, map_area).
- Golden scenarios: G1 ✅ G2 ✅ G3 ✅ G4 ✅ G5 ✅ G6 ✅ G8 ✅ (typed + map on real Gemini; voice via fake
  speech engine; manual mic test pending). G7 (BhumiSeal) is task 17.
- Known issues: free-tier Gemini quota (~20 requests/model/day); mentor review of law summaries,
  Q&A and unverified fees; write tools / AI routes / demo reset are open until task 16.
- Next step: Session 4, task 16 (login with roles, row-level security, private storage, rate limits).

### 2026-11-15 11:00 — Session 3, task 14 (unit converter + fee guide)
- Research: kani is NOT a fixed size — Banglapedia (Agrometrology) gives 1 kani = 120 decimal with a
  40-decimal variant, 1 kani = 20 gonda, 1 gonda = 4 kora; Legalseba: Noakhali kani typically 120,
  Comilla 120 or 30. Bigha standard = 20 katha × 720 sq ft ≈ 33.06 dec. kranti = kora/3 is "common use,
  confirm locally".
- Done: `content/units.json` (sourced sizes + relations), `content/fees.json` (mutation 20+50+1,000+100
  = 1,170 with source and verification note; certified khatian 100 (+40 post), online khatian 100,
  mouza map 520 (+110 post) marked as team research not re-verified; registration lists only the cost
  components — no invented rates; 16122). `lib/engines/units.ts` converter (several amounts, e.g.
  "২ কানি ৫ গন্ডা"; without a local kani size every known size is shown side by side; custom kani and
  bigha sizes; rules explained in Bangla), `lib/engines/fees.ts` (aliases: নামজারি, খারিজ, রেজিস্ট্রি…).
  Tools `unit_convert`, `fee_guide` (prompt tells Sathi to use them and to say which kani size it used).
  Pages `/units` (example button, kani-size choice, custom bigha, cards per size with sources) and
  `/fees` (items, totals, time, source, verification note per service).
- Tests: npm run check green (182: concept example 2 kani 5 gonda → 90 dec / 0.90 acre / 39,204 sq ft at
  40 and 270 / 2.70 / 117,612 at 120; kani family ratios; bigha/acre/sq ft/hectare; custom sizes;
  mutation 1,170; aliases; every service sourced; no registration rates invented).
  npm run e2e green (incl. units-fees.spec on phone + desktop). Build green.
- Known issues: certified copy / mouza map fees and the 28-day mutation target are not re-verified on an
  official page (marked as such on screen). /units and /fees are not linked from the home page yet
  (task 15).
- Next step: task 15 (connect everything: home journey, cross-links, all tools in one chat).

### 2026-11-15 10:10 — Session 3, task 13 (mouza map + map_area)
- Done: `lib/engines/units.ts` (decimal base; sq ft, m², acre, katha 720 sq ft, standard bigha 33.06 dec
  with the size shown; district tables come in task 14), `calibratedAreaDecimals` + `centroid` in
  area.ts, `lib/engines/map.ts` (map from DB polygons; mismatch uses the same thresholds as Jomi Check),
  tool `map_area` (map vs khatian, khas flag, all units, "estimate, not a survey" note). `/map`:
  tabs "মৌজা ম্যাপ" (SVG map, tap or type a dag, keyboard accessible, khas hatched, mismatch dashed,
  unit panel, link to /check) and "নিজের ম্যাপে মাপুন" (image stays on the phone; two clicks + known
  distance in ft/m/chain/link; click corners; undo/restart; area in all units + survey disclaimer).
  Mock model answers "দাগের মাপ কত?" via map_area; chat badges for map_area, warish_compute,
  deed_read, find_person.
- Tests: npm run check green (172: units, calibration, map_area 145≈20.04 match / 143 −3.04 mismatch /
  149 khas / no map for Charpara). npm run e2e green (incl. map.spec: type 145 → ২০.০৪ + units; tap
  149 khas; 143 mismatch; keyboard; upload → calibrate 200 ft → square ≈91.8 dec; chat "মাপ কত?";
  375 px).
- Golden scenarios: G8 map part PASS (≈20.0 dec, matches khatian).
- Next step: task 14 (unit converter with district bigha/kani table + fee and time guide).

### 2026-11-15 09:20 — Session 3, task 12 (deed reader)
- Done: `content/deeds/deed-4512.png` (synthetic sale deed rendered from HTML, watermark
  "নমুনা / SYNTHETIC", fiction notice). Raw vision run first (`npm run ai:vision`, gemini-3.1-flash-lite,
  11.5 s): all fields right except the date (read ১৪ as 18) and "মো:" for "মোঃ" → design: lenient name
  comparison + registry cross-check that flags the date. `lib/ai/vision.ts` (zod schema = JSON schema
  sent to Gemini, prompt treats the image as data, model fallback on 429/5xx because each model has
  its own free daily quota, mock answer for AI_PROVIDER=mock). `lib/engines/deed-check.ts`
  (deterministic Bangla summary from the fields; checks: dag exists (JL fallback), seller on BS
  khatian, area ≤ seller's share (LCPRA s.4), khatian number, registry record match (dag, area, date,
  seller, buyer), plus every Jomi Check rule for the dag). `lib/adapters/storage.ts` (private
  `.uploads/`, random 96-bit ids, type checked from bytes, 5 MB max, id format blocks path tricks).
  Tool `deed_read` (untrusted → wrapped as data), `/api/deed/upload`, `/api/deed/sample`, `/deed` page
  (camera/file upload, sample button, preview, verdict, summary, findings, fields read, link to /check).
- Tests: npm run check green (159: name matching, summary, byte sniffing, path-trick ids; G3 amber with
  MAP_MISMATCH "আমিন" + MUTATION_PENDING; misread date flagged; more-than-share red; wrong seller/
  khatian red; unknown deed amber; non-deed red; mouza spelling → JL fallback; tool end to end).
  npm run e2e green (76): G3 sample → amber → link to /check (amber); non-image refused; real upload.
  REAL: deed_read with Gemini vision → AMBER, flags the misread date, unmutated deed and map mismatch.
- Known issues: the vision model sees the image unmasked (an image cannot be text-masked) — fine for
  synthetic deeds; production needs on-premise OCR or redaction before upload. **Free-tier Gemini
  allows ~20 requests per model per day**; the evaluation runs used up gemini-3.5/3.6/3.8-flash for
  today (reset after ~11 h). Before the demo, either keep a fresh day of quota or enable paid billing.
- Next step: task 13 (/map page and map_area tool).

### 2026-11-15 08:10 — Session 3, task 11 done (warish tool + /warish page)
- Done: `lib/engines/warish-land.ts` (deceased owners with BS holdings; per-dag decimals; total-area
  mode), tool `warish_compute` (zod family schema, also available to Sathi AI), API errors for an
  impossible family (400) or unknown deceased (404). `/warish`: deceased + land selector (or a total
  area), "উদাহরণ: আব্দুল করিমের পরিবার" preset (G2 names), spouse/parents/children/siblings counters,
  predeceased children with their own children (MFLO s.4), result table (name, fraction, %, decimals
  per dag), women's-share card, step-by-step explanation, MOCK OTP consent per heir (code shown on
  screen as a demo SMS; wrong code rejected), and after all heirs confirm the bontonnama → mutation
  checklist (SAT s.143খ, Registration s.17, s.143, Tk 1,170). Select boxes capped to screen width.
- Tests: npm run check green (147: +3 integration for warish_compute on the seeded world).
  npm run e2e green (incl. new g2-warish.spec.ts on phone + desktop: G2 per-dag 7.5/21/21/10.5 and
  5/14/14/7, fractions, names, women's card, consent → checklist, wrong OTP, MFLO on the page, 375 px).
- Golden scenarios: G2 PASS.
- Next step: task 12 (deed reader: vision model on content/deeds/deed-4512.png).

### 2026-11-15 07:00 — Session 3, task 11 (part 1: warish engine) — STOPPED at usage limit
- Done: `lib/engines/fraction.ts` (exact BigInt fractions); `lib/engines/warish.ts` (Hanafi faraid:
  spouse, father, mother, sons, daughters, full siblings; residuary order; 'awl; radd (never to the
  spouse while blood heirs exist); umariyyatayn; MFLO 1961 s.4 for predeceased sons/daughters' children,
  2:1 per stirpes; Bangla step-by-step explanation; `decimalsOf` per dag; shares must sum to exactly 1).
- Tests: 24 warish unit tests (G2: 12.5/35/35/17.5% → dag 210: 7.5/21/21/10.5, dag 211: 5/14/14/7;
  'awl 3/27,4/27,4/27,16/27; radd 1/4,3/4; MFLO s.4; umariyyatayn; siblings; >800 families sum to 1).
  npm run check green.
- NOT done yet (next session): `warish_compute` tool (per-dag decimals from the deceased's BS
  holdings), `/warish` page (family form, Abdul Karim preset, fraction/percent/decimals per dag, mock
  OTP consent per heir, bontonnama → mutation checklist citing SAT s.143B, Registration s.17, s.143),
  e2e for G2.
- Next step: finish task 11 (tool + page + e2e), then tasks 12–15.

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
