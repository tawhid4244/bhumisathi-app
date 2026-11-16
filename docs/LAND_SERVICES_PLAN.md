# BhumiSathi — plan for the 11 land services + a faster, more accurate Sathi AI

Source: the team's list `Bhumi shathi.docx` (11 services, Bangla) and the public land portal
(land.gov.bd and the service sites it links to), read on 2026-11-17 as a **reference only**.
Rules that still apply: synthetic data only, never call or scrape government systems from the
app (they stay mocked behind `lib/adapters/`), every capability = one engine + one tool.

**Status: plan, not built.** Effort: S ≈ ½ session, M ≈ 1 session, L ≈ 2 sessions.

---

## Part 1 — Sathi AI: speed and accuracy (do this first)

> **Status 2026-11-17: Phase A done.** 70.2 s → 3.7 s on the model path, 0.02 s on the fast path;
> AI eval 100% on every measure. Details in docs/PROGRESS.md (Session 5).

### What we measured (real Gemini, 2026-11-17)

Question (as spoken): “১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও”

| Step | Time |
|---|---|
| Model call 1 → chooses `find_dag` (no mouza was said) | 22.7 s |
| Model call 2 → chooses `jomi_check` | 26.7 s |
| Model call 3 → writes the answer (first word appears only now) | 20.5 s |
| **Total, before the citizen sees or hears anything** | **70.2 s** |

Single tiny prompt, to find the cause:

| Model setting | Time |
|---|---|
| `gemini-3.5-flash`, thinking LOW (today's setting) | 20.5 s |
| `gemini-3.5-flash`, thinking MINIMAL | 14.0 s |
| `gemini-3.1-flash-lite`, thinking MINIMAL | **1.0 s** |

So the slowness is mostly **the model choice × three calls in a row**, and nothing is streamed.
Also: each attempt may wait up to 45 s before a fallback is tried (`GEMINI_TIMEOUT_MS`).

### Speed plan (target: spoken verdict in < 3 s for common questions, < 8 s for legal questions)

| # | Change | Where | Effect |
|---|---|---|---|
| S1 | **Fast path without the model** for the common voice intents (dag / khatian number + check, safe to buy, area, inheritance, fee, tax due, “my mutation status”). A deterministic Bangla/English intent parser picks the tool and its inputs; the engine runs at once; the answer is a **template from the engine output** (verdict, top 3 reasons, next step), read aloud. The model is only asked if the parser is unsure. | new `lib/ai/intent.ts`, `agent.ts` | 70 s → **under 1 s** for most voice questions; no quota used |
| S2 | **Model routing:** tool-choosing steps on `gemini-3.1-flash-lite` (thinking MINIMAL); `gemini-3.5-flash` only for open legal questions, and only for the final answer. Keep the eval as the gate (§ accuracy). | `gemini.ts`, `provider.ts` (`AI_ROUTER_MODEL`) | 20 s → ~1–2 s per tool step |
| S3 | **One fewer round trip:** `jomi_check` (and other dag tools) accept a dag without a mouza — resolved in code when unique, otherwise the tool returns “which mouza?” choices. Removes the `find_dag` step. | `ledger.ts`, `check-tools.ts` | −1 model call |
| S4 | **Stream the answer** (`generateContentStream`): text appears word by word; speech starts after the first sentence. | `gemini.ts`, `agent/stream`, `ChatPanel` | first words in ~1 s |
| S5 | **Send only the tools that fit the intent** (3–5, not 16) and a shorter system prompt; keep only the last few turns of history. | `tools.ts`, `prompts.ts` | smaller prompts, faster and cheaper |
| S6 | **Time budget:** 8 s per attempt, then switch to the lighter model at once (no 45 s waits, no slow retries on a slow model). | `gemini.ts` | no multi-minute worst case |
| S7 | **Answer cache** keyed by (normalised question, dag, ledger_version) — a repeat question is instant and always consistent. | new `lib/ai/cache.ts` (Postgres) | instant repeats |

### Accuracy plan

**Voice (speech → text)**

| # | Change | Why |
|---|---|---|
| V1 | Bangla **number-word parser**: “একশো পঁয়তাল্লিশ” → 145, “সাড়ে দশ শতক” → 10.5, mixed ১৪৫/145, “দাগ নং…” | Speech engines often write numbers as words |
| V2 | **Domain correction:** fuzzy-match heard words to the real mouza names, people and services (Bangla-aware edit distance); dag numbers checked against the mouza's range | “নয়া পাড়া”, “নওয়াপাড়া” → নয়াপাড়া |
| V3 | Ask the browser for **5 alternatives** (`maxAlternatives`) and live text (`interimResults`); pick the alternative that parses into a valid dag/mouza | Big accuracy gain for numbers |
| V4 | **Read back only when unsure** (low confidence, or a number that is not in the records) — not every time | Faster, less tiring |
| V5 | **Fallback recogniser:** where Web Speech is missing or unsure (iPhone/Firefox), record audio and send it to `gemini-3.1-flash-lite` with the mouza list as context; returns text + extracted dag/mouza | Works on more phones |
| V6 | Better **spoken replies:** best `bn-BD` voice, slightly slower rate, dag numbers read digit by digit, speak sentence by sentence while streaming | Clearer, starts sooner |
| V7 | **Voice test set:** 30–50 short recordings by team members (different accents, noise), scored for dag-number and mouza accuracy; target ≥ 95% | Measured, not guessed |

**Answers**

| # | Change |
|---|---|
| A1 | **Answer card from the engine** (verdict colour, reasons, holders, next step) — the model only adds a plain-language explanation, so numbers can never be invented |
| A2 | **Number check:** every number in the AI's text must appear in the tool output; otherwise regenerate or fall back to the template |
| A3 | Grow the evaluation from 20 to ~60 held-out questions (include every new service), run on both models; switch a step to `flash-lite` only if it scores at least as well as today (tool choice ≥ 95%, citations 100%, refusals 100%) |
| A4 | Keep today's guards: PII mask, documents as data, writes only after “Yes” |

**Effort:** S1+S3+S4+V1+V2+V3 = M (one session, biggest win). S2+S5+S6+S7+V4–V7+A1–A3 = M.

---

## Part 2 — the 11 land services in BhumiSathi

### The shared foundation (build once, used by most services) — M

> **Status 2026-11-17: Phase B built** (first service on it: certified khatian copy). Details in
> docs/PROGRESS.md (Session 5, Phase B).

Most services are the same shape: **apply → check → (hearing) → decision → document**. Instead of
11 separate workflows, add one framework:

- **`applications`** table: id/number (e.g. `MUT-2026-0001`), type, applicant (user), dag(s),
  status, current step, fee, due dates; **`application_events`** (timeline, who/when/what, also in
  the hash-chained audit log); **`application_documents`** (private uploads, RLS like deeds).
- Engine `lib/engines/applications.ts` (state machine per type: allowed steps, who may move it,
  SLA days) + tools `application_submit`, `application_status`, `application_decide` (officer).
- UI: one **service wizard** (steps, progress bar, document checklist, fee), one **tracker**
  (“আবেদনের অবস্থা” timeline with the next step and deadline), one **officer inbox**.
- **My services** page (`/my`): my dags, my applications, dakhila, copies, complaints,
  notifications (mock SMS + in-app bell).
- **Mock payment** (`lib/adapters/payment.ts`, sandbox only) and **signed documents** (reuse
  BhumiSeal: dakhila, khatian copy, mutation order — all verifiable on `/verify`).

### 1. মিউটেশন / নামজারি (Mutation) — **L, priority 1**

- *Today on the portal:* registration/login, notices, FAQ, statistics, an inheritance calculator;
  steps: application → document check → hearing if needed → approval → khatian (DCR fee).
- *Already in BhumiSathi:* a sale opens a mutation case automatically; fee guide (Tk 1,170);
  warish → bontonnama → mutation checklist.
- *Add:* citizen mutation **wizard** for sale / inheritance / partition (pre-filled from the deed
  or warish result), document checklist, fee breakdown (20 + 50 + 1,100), **hearing notice** (mock
  SMS), officer (AC Land) review and order, and on approval a **new khatian version**: shares move
  in the ledger (ledger_version bumps, sealed reports become “superseded” automatically).
- *Data:* extend `mutation_cases` → applications type `mutation`; `hearings`.
- *Tools:* `mutation_apply`, `mutation_status`, `mutation_decide` (officer).
- *AI:* “আমার নামজারি কোথায় আটকে আছে?” → status + what to do next; explain each step in plain words.
- *Golden G9:* Jamal applies for mutation after buying 10 dec of dag 145 → hearing → approved →
  Jomi Check now shows Jamal 10 dec, Rahim 0; Rahim's old sealed report turns amber.

### 2. ভূমি উন্নয়ন কর (Land development tax) — **M, priority 1**

- *Portal:* register the holding (mobile, NID + date of birth, khatian/dakhila details) → holding
  check → pay → dakhila.
- *Add:* holding registration with **synthetic** NID check (format only), tax **calculator**
  (by land class, area, years due — rates from the Land Development Tax Act 2023 schedule, each
  rate cited and marked “verify”), arrears, **mock payment**, signed **dakhila with QR**
  (verify on `/verify`). Paying updates `land_tax`, which already feeds the “tax arrears” rule.
- *Tools:* `ldt_holding`, `ldt_calculate`, `ldt_pay` (write → read back + Yes).
- *AI:* “আমার খাজনা কত বাকি?” → amount, years, pay link.
- *Golden G10:* holder with arrears → amber in Jomi Check → pays → dakhila verified → green.

### 3. ভূমি রেকর্ড ও ম্যাপ (Records & maps) — **M, priority 2**

- *Portal:* search land → choose copy (khatian / map) → fee → collect.
- *Add:* a printable **khatian view** (CS/SA/RS/BS) and **mouza map sheet** export, “order a
  certified copy” (fee, mock payment, status), and a **signed e-copy** with QR.
- *Tools:* `khatian_view`, `copy_order`. *AI:* “বিএস খতিয়ান ২০৫-এর কপি দাও।”

### 4. ভূমি অধিগ্রহণ ও হুকুমদখল (Acquisition & requisition) — **M, priority 2**

- *Add:* acquisition / requisition **cases on dags** (project, notice date, objection window,
  status). Jomi Check gets a new rule: dag under acquisition notice → **red** (“do not buy”);
  requisition → amber. A **compensation estimator** (law-based formula with the source cited and
  “verify” note) and an **objection** application through the shared framework.
- *Data:* `acquisition_cases`, `acquisition_dags`. *Tools:* `acquisition_lookup`, `compensation_estimate`.
- *AI:* “আমার জমি কি রাস্তা প্রকল্পে পড়েছে? কত ক্ষতিপূরণ পাব?”

### 5. ইজারা ও বন্দোবস্ত (Lease & settlement) — **M, priority 3**

- *Portal:* the page says the service is still being built — a chance to show the idea.
- *Add:* list of khas land / jalmohal / vested property open for lease or settlement (from the
  information bank, #8), **eligibility check** for landless families (policy rules, cited),
  application → officer review → agreement; settled khas land stays **non-transferable** (the
  ledger already blocks khas sales).

### 6. ভূমি প্রশাসন ব্যবস্থাপনা (Land administration) — **M, priority 3**

- *Add for officers:* offices (union land office, AC Land, DC), staff accounts per office,
  **task inbox** fed by applications, assignment, deadlines with red/amber/green SLA badges,
  approval chain (first step of the roadmap's multi-office approval), office performance
  dashboard on `/admin`.

### 7. ভূমি রাজস্ব মামলা (Land revenue cases) — **S–M, priority 2**

- *Add:* revenue cases (miscellaneous, review, arrears) on dags: case number, parties, hearing
  calendar, mock notices, orders. Jomi Check shows an open revenue case as **amber** (like court
  cases). Citizens track by case number; officers record hearings and orders.

### 8. ভূমি তথ্য ব্যাংক (Land information bank) — **M, priority 2**

- *Add:* one register of government land — **khas, vested (অর্পিত) property, jalmohal** —
  growing today's `khas_flags` into `govt_property` (category, area, status: free / leased /
  disputed). Public map layer + search + statistics; officers update. Jomi Check: vested property
  → red, jalmohal → red.

### 9. কারিগরি ও অভিযোগ প্রতিকার (Technical help & complaints) — **M, priority 1**

- *Add:* complaint form (categories: **broker or official asked extra money**, delay, wrong record,
  technical problem), optional anonymous, attach photo; **AI triage** (category, dag, office,
  urgency); routed to the right officer; status timeline and SLA; mock SMS updates; public monthly
  statistics. Linked from `/fees` (“someone asked for more? report it”) and from every tracker.
- *Tools:* `complaint_submit`, `complaint_status`, `complaint_resolve` (officer).
- *Golden G11:* “মিউটেশনে দালাল ৫,০০০ টাকা চেয়েছে” by voice → complaint created with category
  and number → officer resolves → citizen sees it.

### 10. ভূমি দৃষ্টি (Bhumi Drishti — staff attendance & inspection) — **S, priority 4**

- An internal HR tool; out of scope for citizens. Keep only what helps land decisions: a **field
  inspection record** on a dag (amin/officer visit note, photo, browser location with consent),
  shown in mutation and complaint timelines. Needs `geolocation=(self)` in Permissions-Policy.

### 11. ভূমি নকশা (Bhumi Naksha — digital land map & zoning) — **M, priority 2**

- *Add map layers* to `/map`: land class (agricultural / homestead / commercial / water), **land
  use zone** (e.g. agricultural protection zone), khas / vested / acquisition overlays, a legend,
  layer toggles, search by dag, and a “zone” line in Jomi Check (“agricultural zone: change of use
  needs permission”, law cited). A satellite base map only with properly georeferenced synthetic
  data (no real imagery of real plots in the prototype).

---

## Part 3 — more interactive and appealing

- **My services dashboard** with progress steppers, deadlines and a notification bell.
- **Service tracker** by application number (works signed out, shows only status).
- **Voice everywhere:** a mic button on every form (“বলুন: দাগ নম্বর…”), filled by the same parser.
- **Signed documents** (dakhila, khatian copy, mutation order) with QR, printable on A4.
- **Map-first exploration:** click a dag → its report, tax, cases, acquisition, zone in one panel.
- **Guided first visit** (3 tooltips), friendly empty states, skeleton loading, animations that
  respect reduced motion; all Bangla/English.

## Part 4 — order of work (fits the build-prompt rhythm: one task per step, tests first)

| Phase | Tasks | New golden scenarios |
|---|---|---|
| A (1 session) | AI fast path, flash-lite routing, streaming, dag without mouza, number-word parser, domain correction (Part 1) | G8 timing: voice → verdict < 3 s |
| B (1–2 sessions) | Shared application framework + My services + mock payment + signed documents | — |
| C (2 sessions) | Mutation (#1), land tax + dakhila (#2), complaints (#9) | G9, G10, G11 |
| D (2 sessions) | Records & maps (#3), revenue cases (#7), acquisition (#4), information bank (#8), map layers (#11) | G12–G14 |
| E (1 session) | Lease & settlement (#5), office administration (#6), field inspection (#10) | G15 |

Every phase ends like today: unit + integration + e2e green at 375 px and desktop, the AI
evaluation re-run, docs/PROGRESS.md updated, deploy, live check.

## Part 5 — what needs a decision or an expert

1. **Legal numbers** (tax rates, acquisition compensation formula, settlement eligibility,
   hearing deadlines) must come from the official text with a citation — a mentor should confirm
   them before the demo; until then they are shown as “যাচাই প্রয়োজন / to be verified”.
2. **Model choice:** moving tool steps to `gemini-3.1-flash-lite` is the biggest speed win; we only
   switch after the larger evaluation shows no loss in accuracy.
3. **Free AI quota** (≈ 20 requests per model per day): the fast path and the answer cache also
   protect the quota during the live demo.
