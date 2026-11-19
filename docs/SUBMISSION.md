# BhumiSathi — submission pack (International AI Builders Congress 2026)

**Competition:** Idea to Unicorn (team) · **Domain:** CivicSphere AI → Citizen First (LandTech)
**Team:** ByteMates · **Live:** https://bhumisathi-app.vercel.app · **Code:** https://github.com/tawhid4244/bhumisathi-app
**Video:** _(YouTube link)_

Covers every component of guide §9.1 and the preliminary checklist of §9.2.

## 1. Problem definition

- Land is most families' largest asset, and almost 80% of court cases are land disputes
  (land ministry senior secretary, *Observer*).
- The same land is sold to several buyers: over 12,000 plot and flat fraud cases are pending in Dhaka,
  about Tk 4,000 crore stuck (*TBS*). Inheritance is rarely registered and women are pressed not to
  claim (PRI–BRAC study, *FE*). An op-ed citing TIB says 36% of owners paid speed money (*Dhaka Tribune*).
- The record sits in four surveys (CS, SA, RS, BS), deeds, bainas, mortgages and mutation files, in
  different offices. Citizens cannot read it, so they pay brokers.

**Users:** land buyers and sellers, heirs, banks (loan collateral), sub-registry and AC Land offices.

## 2. Solution and AI architecture

**Input → AI → output:** a question (Bangla text or voice), a deed photo, or a dag number → Gemini agent
chooses typed tools (Jomi Check, share ledger, law search, warish, map area, land tax, complaints) →
engines compute every fact in code → the agent explains in plain Bangla with law citations → signed
documents (Ed25519 QR) anyone can verify.

- **Share ledger:** one share of a dag can be promised or sold only once (`register_event()` with a row
  lock). Double sale, mortgaged or khas land, court cases → refused with a reason.
- **Sathi AI:** Gemini agent with tool use, RAG over 11 cited law summaries, vision deed reader, voice
  (Web Speech API, Bangla number words), fast path for common questions (0.02 s).
- **Services:** mutation with hearing, land tax and dakhila, certified copies, complaints, tracker,
  officer inbox — the 11 services of land.gov.bd mapped in the app.

Details and system diagram: [ARCHITECTURE.md](ARCHITECTURE.md) · golden scenarios G1–G11:
[GOLDEN_SCENARIOS.md](GOLDEN_SCENARIOS.md).

## 3. Data and data-sovereignty strategy

- **Prototype data is 100% synthetic** (`is_synthetic = true` on every row; NIDs `SYN-0000-0001`). No real
  person, record or NID. Government sites are never scraped or called; adapters in `lib/adapters/` stand
  in for the official Land Service Gateway, e-mutation and land-tax systems.
- **Hosting:** Supabase Postgres and Vercel, both Singapore region; a national deployment would run in a
  Bangladesh government data centre (all code is portable Postgres + Node).
- **Privacy:** NID and phone masked before any text reaches the model; owner names replaced with
  placeholders; Row Level Security on every table; uploads private; hash-chained audit log; holders see
  who checked their land (role only).
- **Ownership:** land data stays with the government; BhumiSathi stores only what a service needs.

Details: [SECURITY.md](SECURITY.md).

## 4. Demo

Live site, judge mode (`/judge`, 3-minute guided tour, no account needed), and the video. Demo accounts
(citizen, officer, admin) are listed in the README; the password is shared privately with judges.

## 5. Impact and KPIs

Measured in the prototype (results, not targets):

| KPI | Result |
|---|---|
| Double sale / over-sale attempts blocked | 100% in tests (G1, concurrent-sale test) |
| Time to check a plot before buying | < 1 s (voice/text, fast path 0.02 s) vs days at offices |
| AI answer time (model path) | 70 s → 3.7 s after optimisation |
| AI evaluation, 20 held-out questions | tool choice 90–100%, legal citation 88–100%, correct refusal 100% |
| Automated tests | 291 unit/integration + 234 end-to-end (phone and desktop) |

Targets for a one-upazila pilot (to be measured): share of land purchases checked before payment;
mutation decided within the 28-day limit; complaints resolved on time; zero double registrations.

## 6. Business model and commercial viability

_Proposed, not yet validated with customers._

- **Citizens:** free (check, chat, inheritance, complaints) — the public-good layer.
- **Sealed report / verification:** small fee per signed report for buyers, and per check for banks
  and NBFIs verifying collateral (catches land mortgaged twice).
- **API for banks and sub-registries:** pay-per-call or subscription.
- **Government licence (B2G):** land offices license the officer inbox, mutation workflow and audit log
  as software (digital public infrastructure).

## 7. Scalability roadmap

1. Stateless API on serverless hosting + Postgres; scale with read replicas and caching.
2. Read-only adapters to the national land record, e-mutation, land tax and registration systems.
3. Pilot in one upazila → district → national; offline-first mobile and SMS for low bandwidth.
4. Public Merkle log of every seal and ledger event; multi-office approval; escrow; Hindu and
   Christian succession law. (README → Roadmap.)

## 8. Ethical safeguards (responsible AI)

- The AI never decides ownership and never writes to the ledger without the citizen's "Yes" and an
  officer role; every write is read back with its numbers first.
- Legal answers must cite a source; with no source the AI says so and points to 16122 or a lawyer.
- Bias: inheritance shares come from code (Hanafi faraid), protecting women's legal shares; the same
  rules for every user; the AI is evaluated on 20 held-out questions including refusals.
- Uploaded documents are treated as data, never as instructions (prompt-injection tested).
- Every screen says: prototype, synthetic data, not a government website, not legal advice.

## 9. Team ByteMates — roles

| Member | Congress portal role | Responsibility in BhumiSathi |
|---|---|---|
| Tawhid Ahmed | Team Lead | Vision, execution, milestones |
| Mahmud Ibna Arif Akanda | Product/UX Designer | Bangla-first UX, accessibility, product flows |
| Milon Kumar Baidya | Domain Expert | Land law, survey records, user problems, KPIs |
| Arpita Kundu | _to assign: AI/ML Engineer or Full-Stack Developer_ | _to confirm_ |
| Khadiza Akter Summa | _to assign: AI/ML Engineer or Full-Stack Developer_ | _to confirm_ |

Presentation / communication lead: _to confirm_. NRB member: none yet.

**AI usage (Code of Conduct §4):** code, tests and documents were written with Claude Code (Claude Opus
5.5) under the team's direction; every change was checked by automated tests. Product AI: Google Gemini
(see README → "AI tools and models").
