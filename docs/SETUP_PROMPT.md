# Environment setup prompt for Claude Code

Open PowerShell, `cd "C:\My Project\BhumiSathi\bhumisathi-app"`, run `claude`, and paste the prompt below.

```
You are setting up the development environment for BhumiSathi on this Windows laptop.
Read CLAUDE.md and docs/PREP_CHECKLIST.md first. Do NOT build any app code yet; that is task 1.

Work step by step. Before each install or account action, tell me the exact command and wait for my OK.
Never ask me to paste passwords, tokens or API keys into this chat, and never print the contents of .env.local.

STEP 1 — Check tools. Run and report versions (or "missing") for:
  node, npm, git, gh, winget, and whether Google Chrome is installed.
  Required: Node.js LTS 22 or newer, Git for Windows, GitHub CLI.

STEP 2 — Install only what is missing, with winget:
  winget install OpenJS.NodeJS.LTS
  winget install Git.Git
  winget install GitHub.cli
  After installing, tell me to open a NEW PowerShell window if PATH needs refreshing, then re-check versions.

STEP 3 — GitHub login (I will do the browser part).
  Run `gh auth status`. If no account or the wrong account is active:
  tell me to run `gh auth login` myself in a separate PowerShell window
  (GitHub.com → HTTPS → Login with a web browser, signed in to my OTHER GitHub account),
  then wait. When I say done, run `gh auth status` again and `gh auth setup-git`.
  Show me which GitHub username is active and ask me to confirm it is the right one.

STEP 4 — Git for this project only.
  Ask me for the GitHub username and the commit email (suggest the account's noreply email).
  Then: git init (if not already a repo), set `git config user.name` and `git config user.email`
  for THIS repo only (no --global), set the default branch to main.

STEP 5 — Secrets safety.
  Confirm .gitignore covers .env, .env.local and .env*.local.
  Copy .env.example to .env.local with empty values. Tell me which keys I must fill in myself
  (Supabase URL and keys, AI keys, embedding key, seal key) and wait while I fill them in.
  Afterwards only check that each variable is non-empty; do not print any value.
  Run `git status` and prove .env.local is NOT staged.

STEP 6 — First commit and GitHub repo.
  Commit the build kit: "chore: project build kit (CLAUDE.md, plan, scenarios)".
  Ask me public or private (the Congress needs a public repo for submission), then run:
  gh repo create bhumisathi-app --public --source . --remote origin --push
  Show me the repo URL.

STEP 7 — Supabase CLI check (no project changes yet).
  Run `npx supabase --version` to confirm the CLI works through npx.
  Tell me to create the Supabase project in the browser if I have not, and to enable
  the pgvector extension there. Do not run any database commands yet.

STEP 8 — Report.
  Add a dated entry to docs/PROGRESS.md: tool versions, active GitHub account, repo URL,
  which .env.local variables are filled (names only), anything still missing.
  Commit "chore: environment setup report" and push.
  Finish with a checklist of what is ready and what I still need to do before Session 1.
```

## What only you can do (Claude Code cannot do these for you)

1. Install Claude Code itself first: `irm https://claude.ai/install.ps1 | iex` in PowerShell.
2. Finish browser sign-ins: GitHub (`gh auth login`) and creating the Supabase project.
3. Get the API keys and type them into `.env.local` yourself.
4. Approve each install and command when Claude Code asks.
