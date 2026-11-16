# Deploying BhumiSathi (Vercel + Supabase)

The live site is one Next.js app on **Vercel** (region Singapore, `sin1`) and one Postgres database on
**Supabase** (region Singapore). The browser never talks to the database; only our server does.
Secrets are typed into hidden prompts or imported as a file — never pasted into chat or committed.

## 1. Database (Supabase, free plan)

1. supabase.com → sign in → **New project**: name `bhumisathi`, region **Southeast Asia (Singapore)**,
   click *Generate a password* and keep it in your password manager.
2. When the project is ready: **Connect** (top bar) → **Session pooler** (or Transaction pooler) → copy the URI.
   The app always uses the session pooler (port 5432): the transaction pooler (6543) mixes up
   results when postgres.js sends several queries on one connection (seen as hanging pages).
   Replace `[YOUR-PASSWORD]` in it with the password from step 1.
3. In the `bhumisathi-app` folder: `npm.cmd run set-db` → paste the URI (hidden) → Enter.
4. `npm.cmd run cloud:setup` → migrations, synthetic world, demo accounts, law embeddings.
   Later releases that add a migration: `npm.cmd run cloud:migrate` (migrations only, no reseed)
   BEFORE pushing the code.

Security notes: migration `0006_cloud_ready.sql` removes every privilege from Supabase's public API
roles (`anon`, `authenticated`), so the Supabase anon key gives no access to tables, views or
functions. RLS is on for every table. The server connects over TLS.

## 2. Website (Vercel, Hobby plan)

1. `npm.cmd run vercel:env` → writes `.env.vercel.local` (git-ignored). Variables (names only):
   `DATABASE_URL`, `AUTH_SECRET`, `SEAL_PRIVATE_KEY`, `AI_PROVIDER`, `AI_API_KEY`, and if set:
   `AI_CHAT_MODEL`, `AI_FALLBACK_MODELS`, `AI_VISION_MODEL`, `AI_EFFORT`, `EMBEDDING_PROVIDER`,
   `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`. Later: `SITE_URL`.
   Not needed on Vercel: `DEMO_USER_PASSWORD`, `CLOUD_DATABASE_URL`, the Supabase keys.
2. vercel.com → sign in with GitHub → **Add New… → Project** → import `bhumisathi-app`
   (allow Vercel to see the repository if asked).
3. Before clicking Deploy: open **Environment Variables** → **Import .env** → choose
   `.env.vercel.local`. Then **Deploy**.
4. Copy the site address (e.g. `https://bhumisathi-app.vercel.app`), then
   `npm.cmd run vercel:env -- https://<your-site>` and add the new `SITE_URL` variable in Vercel
   (Settings → Environment Variables), then **Deployments → ⋯ → Redeploy**.
5. Delete `.env.vercel.local` when done.

## 3. Check it

- `npm.cmd run e2e:live -- https://<your-site>` runs the browser tests that do not depend on the
  scripted test model (phone width) against the live site.
- Phone checklist: see docs/PROGRESS.md (task 19).

## Switches

- `JUDGE_MODE=off` hides the public judge tour; `DEMO_RESET_DISABLED=true` blocks resets.
