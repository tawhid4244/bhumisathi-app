# Before Session 1 (team work, about 2 hours, no Claude Code needed)

## Accounts and keys
- [ ] GitHub repository created (public for submission); this folder pushed as the first commit
- [ ] Supabase project created; URL, anon key, service key saved in `.env.local` (never committed)
- [ ] Vercel account linked to the repo
- [ ] AI API key for a model that handles Bangla, images and tool calling; embedding model chosen for RAG
- [ ] Spending limit set on the AI key

## Machine
- [ ] Node.js LTS, Git, Chrome installed; Claude Code installed and signed in
- [ ] 5-minute test: Bangla speech recognition works in Chrome on this laptop (if not, typed input is the main path)

## Content Claude Code cannot invent (put in `content/`)
- [ ] `content/laws/`: about 10 law sections copied by hand, one file each, with title, section and source line
      (SAT Act 1950 s.143; Registration Act 1908 key sections; Land Crime Prevention and Remedy Act 2023;
      MFLO 1961 s.4; Land Development Tax Act 2023). No scraping.
- [ ] `content/qa.json`: 60 common questions with answers and law ids, checked by the faculty mentor; 20 more held out for eval
- [ ] `content/deeds/deed-4512.png` and 1–2 more synthetic deed or porcha images (typed in Bangla, clearly marked "নমুনা / SYNTHETIC")
- [ ] `content/maps/nayapara.json` (dag polygons 141–149) — copy from the pitch page; Claude Code renders the PNG
- [ ] Fee table (from land.gov.bd fee page): mutation 20 + 50 + 1,100; certified khatian 100 (+40 post); online khatian 100; mouza map 520 (+110 post)
- [ ] District unit table (kani 40 / 120 dec examples, bigha 33 / 30 / 35 dec)

## Team (Congress rule)
- [ ] 3–5 members plus one NRB, each with a named role: leader, business/data, UI/UX, backend/data, presentation
- [ ] Who sits with Claude Code in each session; who tests between sessions

## Demo
- [ ] 3-minute video storyboard agreed (problem → solution → demo → AI approach → impact), mapped to G1, G8, G3, G2
