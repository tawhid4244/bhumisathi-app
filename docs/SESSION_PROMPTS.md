# Prompts to paste into Claude Code

## Opening prompt (every session)

```
Read CLAUDE.md, docs/PLAN.md, docs/GOLDEN_SCENARIOS.md and docs/PROGRESS.md.
This is Session N (tasks A–E). Summarise the current state in 5 lines, list anything red,
then make a step-by-step plan for task A only. Wait for my OK before writing code.
```

## Per-task prompt

```
Build task #X from docs/PLAN.md.
Follow the Definition of done in CLAUDE.md: engine + unit tests first, then tool registration,
API route, UI, and the related golden scenario test. Use only the seeded synthetic data.
Run `npm run check` (and `npm run e2e` for the related scenario) and show me the results.
When green, commit with a clear message and update docs/PROGRESS.md.
```

After each task: clear the conversation (`/clear`) and start the next task with the per-task prompt.

## When something breaks

```
Stop adding features. Reproduce the failure with a test, find the root cause,
fix it with the smallest change, and show the test passing. Explain the cause in 3 lines.
```

## Integration gate (last 45 minutes of every session)

```
Run `npm run seed`, `npm run check` and `npm run e2e`. Fix only what is red.
Then walk through every golden scenario built so far and tell me which pass.
Commit, push, and write the session summary in docs/PROGRESS.md
(done, tests, decisions, known issues, exact next step).
```

## Session-specific openers

- **Session 1:** "Start with task 1. Use Next.js App Router + TypeScript strict + Tailwind + Vitest + Playwright + Supabase. The seed must reproduce the synthetic world in GOLDEN_SCENARIOS.md exactly."
- **Session 2:** "Before building the agent, write a 10-line spike that sends one Bangla question with one tool to the model and prints the tool call. If it fails, tell me before continuing."
- **Session 3:** "Before task 12, run the vision model once on content/deeds/deed-4512.png and show me the raw JSON. Adjust the schema from what it returns."
- **Session 4:** "Security first (16, 17), then polish, then deploy. Do not change engine behaviour in this session unless a test is red."
