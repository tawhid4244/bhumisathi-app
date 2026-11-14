# Build plan: 4 sessions × 5 tasks (about 20 hours of Claude Code)

Order is by risk: the deterministic trust core first, the uncertain AI parts second, then multimodal features,
then security and release. Each task lists how we check it is done. "G" = golden scenario.

## Session 1 — Foundation and trust core (no AI)

| # | Task | Done when |
| --- | --- | --- |
| 1 | Scaffold: Next.js + TS strict + Tailwind + fonts, Vitest, Playwright, `npm run check`, Supabase client, `.env.example` | App runs; `npm run check` green; CI-style script works |
| 2 | Schema + deterministic seed (`scripts/seed.ts`): mouzas, dags, khatians CS/SA/RS/BS, owners, shares, deeds, bainas, liens, cases, khas flags, map polygons | `npm run seed` twice gives identical data; every row `is_synthetic` |
| 3 | Share ledger: `ledger_events`, balance view, SQL `register_event()` with row lock; engine `ledger.ts`; tools `ledger_status`, `register_baina`, `register_sale`, `register_lien` | Unit + integration tests incl. parallel-sale test; G1 steps 1–3 pass via API |
| 4 | Jomi Check rules engine (`rules.ts`) + `/check` report page (verdict, reasons, chain view) | Red flags for G1, G4, G5; chain CS→BS shown; reasons in Bangla |
| 5 | `/registry` sub-registry demo screen, mock SMS log, mutation case auto-create, one-click "Reset demo" | G1, G4, G5 e2e pass |

End of session 1: commit, update PROGRESS.md.

## Session 2 — Sathi AI (riskiest part, built early)

| # | Task | Done when |
| --- | --- | --- |
| 6 | AI provider adapter + agent loop with tool calling over `lib/tools/registry.ts`; Bangla system prompt; confirmation step before any action | Agent picks `jomi_check` for G8 question; returns same verdict as `/check` |
| 7 | RAG: `content/laws/*.md` + `qa.json` → chunks + embeddings in pgvector; `rag.search`; citation and refusal rules | G6 passes; no-source question refused |
| 8 | `/chat` UI: streaming, tool-call badges, sources list, Bangla/English | Usable on phone width |
| 9 | Voice: push-to-talk (Web Speech `bn-BD`), number read-back, speechSynthesis reply, typed fallback | G8 passes in Chrome manually; typed path passes in e2e |
| 10 | Guardrails + eval: `pii.ts` masking, document-as-data wrapper, `scripts/eval-ai.ts` with 20 held-out questions | Eval report: tool choice, citation present, refusal correct; no NID reaches the model (unit test) |

## Session 3 — Multimodal features and calculators

| # | Task | Done when |
| --- | --- | --- |
| 11 | Warish engine (Hanafi, 'awl, radd, MFLO s.4) + `/warish` UI + `warish_compute` tool + mock OTP consent + bontonnama checklist | G2 and all unit cases pass |
| 12 | Deed reader: upload → vision model → zod-validated JSON → Bangla summary → cross-check with ledger; `deed_read` tool | G3 passes with `deed-4512.png` |
| 13 | Mouza map tool: render `nayapara.json`, select by tap or dag number, shoelace area, units; "upload your map" mode with scale calibration and click-to-mark polygon; `map_area` tool | Dag 145 ≈ 16.6 dec; mismatch on 143; khas 149 flagged |
| 14 | Unit converter (district table) + fee and time guide (`fees.ts`, data-driven) + tools | Mutation total 1,170; kani 40 vs 120 dec examples correct |
| 15 | Wire everything into the agent; home page journey; cross-links (report → warish → map → chat) | One conversation can run G1 check, G3 deed, G8 map without leaving chat |

## Session 4 — Security, polish, release

| # | Task | Done when |
| --- | --- | --- |
| 16 | Auth with roles (citizen, officer, admin), Supabase RLS, private storage with short signed URLs, rate limit on AI routes | Citizen cannot read another user's uploads (integration test) |
| 17 | Hash-chained audit log (every view and write; "who checked my land") + BhumiSeal-lite (Ed25519 signed QR, `/verify`, freshness) | G7 passes; audit chain verifies; tamper test fails as expected |
| 18 | `/admin` and officer views, empty/error states, mobile layout, accessibility pass, demo "judge mode" button | All pages usable at 375 px; keyboard focus visible |
| 19 | Deploy (Vercel + Supabase), env secrets, seed in cloud, smoke test on a real phone | Public URL works; all e2e pass against staging |
| 20 | README (run, data, every AI tool used), ARCHITECTURE.md with diagram, SECURITY.md, `/docs/*` pages, roadmap | A new teammate can run it from README in 15 minutes |

## Not in the prototype (roadmap slide)

Full BhumiSeal (Merkle log, Share-Sum Proof), five-signature approval, escrow, owner self-lock, real SMS,
AI fraud score, bank API, office scorecards, NRB embassy service, government integrations.
