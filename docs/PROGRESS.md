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
