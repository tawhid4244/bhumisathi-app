# Golden scenarios (the contract every feature must satisfy)

These eight stories ARE the demo video and the integration test suite. The seed script must create exactly
the data below; each scenario has one Playwright file `tests/e2e/gN-*.spec.ts`. A session ends only when every
scenario built so far passes. All data is synthetic.

## Shared synthetic world (seed 2026)

- District Dhaka (synthetic), upazila "Demo Upazila"
- Mouza **Nayapara**, JL 45, sheet 1, map scale 16 in = 1 mile, dags 141–149 with map polygons plus 150–179 table-only (polygons in `content/maps/nayapara.json`,
  map units: 1000 = 1 inch; areas from the shoelace formula)
- Mouza **Charpara**, JL 46, dags 210–230 (table data only, no map)
- About 60 dags total, each with CS → SA → RS → BS khatian chain (dag numbers may change across surveys)
- People (fictional): Md. Rahim Uddin, Karim Hossain, Buyer A (Salma Akter), Buyer B (Jamal Mia),
  Abdul Karim (deceased), Rokeya Begum (his wife), sons Sohel and Rubel, daughter Nasrin, Demo Bank Ltd.

## G1 — Double sale blocked (dag 145)

- Rahim holds 20 decimals in dag 145 on the latest BS khatian; tax paid; no locks.
- Step 1: register baina B-0021, Buyer A, 10 dec, 90 days → OK; SMS log to Rahim and Buyer A.
- Step 2: sale of 15 dec to Buyer B → BLOCKED: "only 10 sellable; 10 reserved by baina B-0021"; SMS to Buyer A.
- Step 3: sale of 10 dec to Buyer B → OK; mutation case auto-created (status pending, day-28 deadline).
- Jomi Check for dag 145 after step 2 → RED with reason "requested area exceeds sellable balance".
- Concurrency test: two parallel 10-dec sales after step 1 → exactly one succeeds.

## G2 — Inheritance per dag (Charpara 210, 211)

- Abdul Karim (deceased) held 60 dec in dag 210 and 40 dec in dag 211.
- Heirs: wife Rokeya, sons Sohel and Rubel, daughter Nasrin.
- Expected per 100 dec: wife 12.5; each son 35; daughter 17.5 → per dag: 210 → 7.5 / 21 / 21 / 10.5; 211 → 5 / 14 / 14 / 7.
- Each heir confirms by mock OTP; then the "bontonnama → mutation" checklist appears.
- Extra unit cases: wife + father + mother + 2 daughters ('awl: 3/27, 4/27, 4/27, 16/27);
  mother + 1 daughter (radd: 25% / 75%); predeceased son's children take his share (MFLO s.4).

## G3 — Deed reader + area mismatch (dag 143)

- Synthetic deed image `content/deeds/deed-4512.png`: sale deed 4512/2024, seller Rahim, buyer Karim Hossain,
  Nayapara JL 45, dag 143, BS khatian 210, 8 decimals.
- Upload → extracted JSON matches those fields → Bangla summary → cross-check:
  khatian records dag 143 as 3 dec more than the map area → AMBER "verify boundary with an amin".

## G4 — Khas land (dag 149)

- Dag 149 is a khas waterbody. Jomi Check → RED "khas land: cannot be sold". Any sale → BLOCKED.

## G5 — Mortgage and court case (dags 146, 142)

- Dag 146: Demo Bank lien on 5 dec → sale of that portion BLOCKED without bank release; report AMBER/RED with reason.
- Dag 142: open civil suit (synthetic case no. 101/2025) → RED "court case pending".

## G6 — Cited legal answer

- Question: "নামজারি করতে কী কী লাগবে আর খরচ কত?"
- Agent calls `fee_guide("mutation")` and `rag.search`. Answer states Tk 1,170 = 20 + 50 + 1,100, lists documents,
  cites a `content/laws` id (State Acquisition and Tenancy Act 1950, s.143) and the land.gov.bd fee page.
- Question with no source (e.g. about a specific court strategy) → refusal + 16122 / lawyer hand-off.

## G7 — BhumiSeal-lite

- Generate report for dag 141 → QR holds fields + Ed25519 signature + ledger_version.
- Verify genuine → GENUINE + CURRENT.
- Edit one digit in the payload → NOT GENUINE.
- Re-verify an old report after a new event on the dag → GENUINE but SUPERSEDED (amber).

## G8 — Voice to action

- Push-to-talk (or typed fallback in CI): "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও".
- Agent repeats "আপনি কি ১৪৫ নম্বর দাগ বলেছেন?", user confirms, agent calls `jomi_check(dag=145)`,
  answer is read aloud and shown with the same verdict and reasons as the /check page.
- Mouza question: "১৪৫ নম্বর দাগের মাপ কত?" → `map_area(145)` → about 20.0 decimals, matches khatian. (Map scaled ×1.1 on 2026-11-14 so dag 145 fits Rahim's 20 dec in G1.)
