# BhumiSathi — security

BhumiSathi handles land records, identities and money decisions, so it is built as if the data were
real, even though every row in this prototype is synthetic. This page lists what is protected,
how, and how each control is tested. Gaps are listed honestly at the end.

## What we protect against

| Threat | Example |
|---|---|
| Double sale / over-sale | Selling a share that is already sold, under baina or mortgaged |
| Unauthorised writes | A citizen (or the AI) recording a sale |
| Data leaks | One citizen reading another's deed; NID/phone reaching the AI or other users |
| Account attacks | Password guessing, stolen session cookies, cross-site requests |
| Forged or stale reports | A seller showing an edited or out-of-date land report |
| Prompt injection | A deed image or law text telling the AI to do something |
| Silent tampering | Someone editing who looked at a plot or what was registered |
| Abuse / cost | Flooding the AI or upload endpoints |

## Controls

### 1. The ledger cannot be oversold
- All baina / sale / mortgage writes go through one SQL function, `register_event()`, which locks
  the dag row (`SELECT … FOR UPDATE`) and recomputes the sellable share inside the same transaction.
  Khas land, a pending court case (TPA 1882 s.52) or a deceased holder block a sale.
- Tested: `tests/integration/ledger.test.ts` (G1 numbers, parallel double sale → exactly one wins),
  `tests/e2e/g1-*.spec.ts`, `g4`, `g5`.

### 2. Identity and sessions
- Passwords: **scrypt** (N = 2^17, r = 8, p = 1, OWASP), 16-byte salt, constant-time comparison,
  minimum 12 characters; unknown emails take the same time as wrong passwords.
- Sessions: random 256-bit token in an **httpOnly, SameSite=Lax** cookie (`__Host-` prefix and
  Secure in production); only its **SHA-256** is stored; 8 h expiry; logout deletes the row.
- **Lockout:** 5 wrong passwords → 15 minutes. One message for “no such account” and “wrong
  password”, so emails cannot be discovered.
- Login works before the page's JavaScript loads and always uses POST, so a password can never end
  up in an address bar, history or server log.
- Tested: `tests/unit/auth.test.ts`, `tests/integration/auth-rls.test.ts`, `tests/e2e/auth.spec.ts`.

### 3. Roles and least privilege
- `public` < `citizen` < `officer` < `admin`. Every tool declares its access level; `runTool`
  refuses with 401/403 and requires an explicit caller context (no route can forget it).
- Only officers can record sales, bainas and mortgages — also when asked through the AI chat.
  Only admins reset the demo or unlock accounts. A citizen's AI never even sees write tools.
- Tested: registry/agent unit tests (forged “pending sale” refused), ledger API 401/403.

### 4. Row Level Security in the database
- **RLS is enabled on every table** (deny by default). User-scoped reads run as the restricted role
  `app_user` with the user id set per transaction (`lib/auth/db.ts`), so even a bug in a route
  cannot return another citizen's rows.
- `app_user` can read land records but **never** NID or phone columns, accounts, sessions, the
  audit log's actors or its hashed text, and cannot call the ledger-write or audit functions.
- On Supabase, all privileges are removed from the public API roles (`anon`, `authenticated`) —
  tables, views, functions and future objects — and `EXECUTE` is revoked from `PUBLIC`.
  Verified on the cloud database (0 readable tables or views for `anon`).
- Tested: `auth-rls.test.ts` (RLS on 100% of tables, NID/phone denied, function calls denied).

### 5. Private documents
- Deed images are stored **in the database** behind RLS: a citizen can read only their own upload;
  officers can read all; anyone else gets “not found” (we never confirm the file exists).
- The real file type is detected from its bytes (PNG/JPEG/WebP only, max 5 MB).
- Viewing links are **HMAC-signed, valid 5 minutes, and bound to the file and the user**.
- `deed_read` checks ownership **before** any model sees the image.
- Tested: “another citizen cannot read my deed, even with its id and my signed link” (e2e + integration).

### 6. AI safety
- **PII mask:** NIDs, phone numbers and owner names are replaced with placeholders before any text
  reaches the model and restored only for the citizen (`lib/ai/pii.ts`).
- **Documents are data:** deed text and retrieved law text are wrapped as data, never instructions
  (`lib/ai/documents.ts`); a guardrail test feeds an injected instruction and checks it is ignored.
- **No silent writes:** write tools are never executed by the agent loop; the citizen sees the
  numbers read back and must press Yes; the role is checked again on that request.
- **Grounded answers:** legal answers cite a `content/laws` id; with no source the AI says so and
  points to 16122 or a lawyer. Ownership is never decided by the AI.
- Tested: `tests/unit/pii.test.ts`, `guardrails.test.ts`, `agent.test.ts`, AI evaluation
  (refusals 100%, writes held 100%).

### 7. Tamper evidence
- **Hash-chained audit log:** every view and write made through a tool (and refused write attempts)
  appends an entry whose hash covers the previous one; `verifyAuditChain()` finds the first edited,
  inserted or deleted entry. Audit is fail-closed (no entry, no answer).
- **BhumiSeal-lite:** reports are signed with **Ed25519**; `/verify` rejects any changed digit, flags
  a report that is no longer current, and checks the issue is in an intact audit chain.
  The public key is published at `/api/seal/key`.
- Tested: `tests/integration/audit-seal.test.ts` (edit / rewrite / delete → caught; G7).

### 8. Web and API hardening
- **CSRF:** `proxy.ts` refuses state-changing API requests marked cross-site (Origin /
  Sec-Fetch-Site), on top of SameSite cookies. Login redirects accept only our own paths.
- **Headers:** HSTS (2 years, preload), `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy`,
  `Permissions-Policy` (microphone/camera self only), CSP with `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri`, `form-action`. No `X-Powered-By`.
- **Rate limits** (Postgres, shared by all instances): Sathi AI 15/min and 300/day per user,
  uploads 10/min per user, login 10/min per IP, judge mode 60 steps and 6 resets per minute per IP.
- **Errors** never return stack traces or SQL; users see a short Bangla/English message.
- **Input validation:** every tool input and output is validated with zod; numbers and ids are
  bounded; ids are checked by pattern (blocks path tricks).

### 9. Secrets
- Secrets live only in `.env.local` (git-ignored) and in the host's encrypted settings. They are
  entered through hidden prompts (`npm run set-key`, `npm run set-db`) or generated
  (`npm run users`) and never printed, logged, committed or pasted into chat.
- `/api/health` reports only yes/no per setting and an error code — never a value.
- The cloud database is reached over TLS only.

## Known gaps (prototype)

- The script CSP is not yet nonce-based (Next.js inline scripts); planned with per-request nonces.
- Judge mode can reset the shared demo world for everyone (rate-limited, synthetic data only;
  switch off with `JUDGE_MODE=off`).
- Sessions are our own (Postgres) rather than Supabase Auth; no multi-factor login yet.
- The audit chain lives in the same database it protects; the roadmap moves it to an external,
  append-only Merkle log (full BhumiSeal).
- Free Supabase projects pause after a week without traffic.
- Law summaries and some fees still need expert review (marked in `content/`).

## Reporting a problem

Please open a private report to the team (do not file public issues with exploit details).
