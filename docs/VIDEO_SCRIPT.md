# BhumiSathi — 3-minute submission video (Idea to Unicorn · CivicSphere AI → Citizen First)

Follows the Congress guide §9.2 exactly: Problem 0:30 · Solution 0:30 · Demo 1:00 · AI approach 0:30 ·
Impact 0:30 = **3:00**. Bangla narration, English subtitles. Every number on screen is real app output
or a cited source — no mock-ups (guide §15: "no misleading or fabricated demos").

## Before you record

- Site: https://bhumisathi-app.vercel.app · press **Reset demo** (or start Judge mode) first.
- Browser at phone size: Chrome → F12 → device toolbar → 412 × 915, zoom 100 %. Hide bookmarks bar.
- Accounts: citizen + officer demo accounts (password: `DEMO_USER_PASSWORD` in `.env.local`).
- Record each segment as its own clip in **OBS Studio** (1920×1080, 30 fps). Edit in **Clipchamp**.
- Voice: one person, phone mic 15 cm away, quiet room; record narration separately and lay it over.
- Lower third, whole video: `Prototype · synthetic data · not a government website`.
- AI steps (deed, chat law answer) call Gemini — record them twice; keep the better take. The voice
  dag check (step 3) needs no AI and never fails.

---

## 1 · Problem — 0:00–0:30

*Screen:* black title "এক জমি, একাধিক বিক্রি" → three facts appear one by one, source in small text →
cut to a paper khatian / deed stack (stock photo or your own phone photo).

> **বাংলা:** “বাংলাদেশে আদালতের প্রায় ৮০ শতাংশ মামলা জমি নিয়ে। শুধু ঢাকায় বারো হাজারের বেশি প্লট ও ফ্ল্যাট প্রতারণার মামলা ঝুলে আছে — একই জমি একাধিক জনের কাছে বিক্রি। রেকর্ড ছড়িয়ে আছে চারটি জরিপ আর তিনটি অফিসে; সাধারণ মানুষ দালালের উপর নির্ভর করেন।”
>
> **Subtitle:** “Almost 80% of court cases in Bangladesh are about land. Over 12,000 plot and flat fraud cases are pending in Dhaka alone — the same land sold to several buyers. Records are split across four surveys and three offices, so people depend on brokers.”

On-screen sources (small): *Observer — land ministry senior secretary (≈80%) · TBS (12,000 cases, Tk 4,000 crore stuck)*.

## 2 · Solution — 0:30–1:00

*Screen:* home page hero (logo, "এক জমি, এক সত্য") → slow scroll over the service cards → `/services`
(the 11 land services).

> **বাংলা:** “ভূমিসাথী — এক জমি, এক সত্য। একটি শেয়ার লেজার, যেখানে প্রতিটি দাগের প্রতিটি অংশ একবারই বিক্রি করা যায়। তার উপর সাথী এআই — বাংলায় লিখে বা মুখে বলে প্রশ্ন করুন: জমি কেনা নিরাপদ কি না, দলিলে কী লেখা, আইনে কী বলে, নামজারি কোথায় আটকে আছে।”
>
> **Subtitle:** “BhumiSathi — one plot, one truth. A share ledger where each share of a plot can be sold only once. On top, Sathi AI: ask in Bangla, typed or spoken — is this land safe to buy, what does my deed say, what does the law say, where is my mutation stuck.”

## 3 · Demo — 1:00–2:00 (four quick beats, ~15 s each)

**3a · Double sale blocked (1:00–1:15)** — `/judge` → start → press next to the red card
“একই জমি দুইবার বিক্রি — আটকে গেল”.
> “রহিমের ২০ শতকের মধ্যে ১০ শতক বায়না হয়ে গেছে। একই জমির ১৫ শতক আরেকজনের কাছে বিক্রির চেষ্টা — সিস্টেম সঙ্গে সঙ্গে আটকে দিল।”
> *“10 of Rahim's 20 decimals are already promised. Trying to sell 15 to someone else is blocked instantly.”*

**3b · Voice check (1:15–1:30)** — `/chat` (citizen) → mic → say “একশো পঁয়তাল্লিশ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও” → read-back card → ঠিক আছে → answer appears instantly.
> “মুখে বলুন — সাথী নম্বরটা আবার শুনিয়ে নিশ্চিত হয়, তারপর এক সেকেন্ডের কম সময়ে উত্তর।”
> *“Just say it — Sathi reads the number back, then answers in under a second.”*

**3c · Signed report (1:30–1:45)** — `/check` dag 141 → “সিলযুক্ত রিপোর্ট নিন” → QR → verify → four green lights.
> “ব্যাংক বা ক্রেতা QR স্ক্যান করলেই দেখেন — আসল, হালনাগাদ, অক্ষত।”
> *“A bank or buyer scans the QR: genuine, current, untouched.”*

**3d · Services (1:45–2:00)** — `/chat`: say “মিউটেশনে দালাল ৫,০০০ টাকা চেয়েছে” → confirmation card →
হ্যাঁ → CMP number → cut to `/land-tax` dakhila with QR (2 s).
> “দালাল টাকা চাইলে মুখে বললেই অভিযোগ — আপনার ‘হ্যাঁ’ ছাড়া কিছুই জমা হয় না। নামজারি, খাজনা, দাখিলা — সব এক জায়গায়।”
> *“A broker asks for money? Say it, and it becomes a complaint — nothing is filed without your Yes. Mutation, land tax, receipts — all in one place.”*

## 4 · AI approach — 2:00–2:30

*Screen:* docs/ARCHITECTURE.md on GitHub (its Mermaid diagram renders there) → zoom/highlight boxes as named.

> **বাংলা:** “এআই কখনও মালিকানা ঠিক করে না — হিসাব করে কোড, এআই বোঝায়। জেমিনি এজেন্ট একই যাচাই-টুল চালায়, ১১টি আইনের সারাংশ থেকে ধারা উল্লেখ করে উত্তর দেয়, দলিলের ছবি পড়ে। এনআইডি ও ফোন নম্বর এআই-এর কাছে যাওয়ার আগেই লুকানো হয়; প্রতিটি দেখা ও পরিবর্তন হ্যাশ-চেইনড অডিট লগে থাকে।”
>
> **Subtitle:** “AI never decides ownership — code computes, AI explains. A Gemini agent calls the same check tools, cites sections from 11 law summaries, and reads deed photos. NIDs and phone numbers are masked before the model sees anything; every view and change goes into a hash-chained audit log.”

On-screen chips: `Gemini agent + tools` · `RAG with citations` · `Vision deed reader` · `Fast path: 0.02 s` · `PII masking` · `Ed25519 seal` · `Row-level security`.

## 5 · Impact & next step — 2:30–3:00

*Screen:* KPI card (from docs/SUBMISSION.md) → roadmap card → closing logo.

> **বাংলা:** “নাগরিকের জন্য বিনামূল্যে; ব্যাংক ও ক্রেতা সিলযুক্ত রিপোর্টের জন্য, আর ভূমি অফিস সফটওয়্যার হিসেবে। লক্ষ্য: কেনার আগে প্রতিটি জমি যাচাই, দালাল ছাড়া সেবা, আর একই জমি দুইবার বিক্রি শূন্য। পরের ধাপ: সরকারি ভূমি সেবা গেটওয়ের সাথে সংযোগ ও একটি উপজেলায় পাইলট। ভূমিসাথী — এক জমি, এক সত্য।”
>
> **Subtitle:** “Free for citizens; banks and buyers pay for sealed reports, land offices license it as software. The goal: every plot checked before purchase, services without brokers, zero double sales. Next: connect to the government land service gateway and pilot in one upazila. BhumiSathi — one plot, one truth.”

End card: team **ByteMates** · live URL · GitHub URL.

---

## Editing checklist (Clipchamp)

1. Import clips 1–5 + narration; trim each to its time box (export must be ≤ 3:00).
2. Captions: paste the English subtitle lines (or Clipchamp "Auto captions" → English, then correct).
3. Text: section titles ("সমস্যা · Problem", …) top-left, 1 s fade.
4. Music: Clipchamp stock, low (−25 dB) under the voice.
5. Export 1080p → YouTube **Unlisted** → check the link in a private window.
