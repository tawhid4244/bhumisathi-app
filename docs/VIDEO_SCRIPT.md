# BhumiSathi — 3-minute demo video script

Follows **judge mode** (`/judge`) so every number on screen is real engine output, not a mock-up.
Record on a phone-sized window (or a real phone) in **Bangla mode**, with English subtitles.
Total: about **3:00**. Narration in Bangla; the English line is the subtitle.

**Before recording:** open https://bhumisathi-app.vercel.app, make sure the AI key has quota left
(the deed and chat steps use two model calls), sign in as nobody (judge mode needs no account),
close other tabs, turn on Do Not Disturb.

---

### 0:00–0:15 · Hook (home page)

*Screen:* home page hero, slow scroll to the service cards.

> **Narration:** “বাংলাদেশে অনেক জমির মামলার শুরু একটাই জায়গায় — একই জমি দুইবার বিক্রি। ভূমিসাথী বলে, এক জমি, এক সত্য।”
>
> **Subtitle:** “Many land disputes in Bangladesh start in one place — the same land sold twice. BhumiSathi says: one plot, one truth.”

### 0:15–0:25 · Start judge mode

*Screen:* press **“▶ জাজ মোড — ৩ মিনিটে দেখুন”**, then **“জাজ মোড শুরু করুন”**. Card 1: the demo resets.

> “সব তথ্য কাল্পনিক। নয়াপাড়া মৌজার দাগ ১৪৫ — রহিম উদ্দিনের ২০ শতক।”
>
> *“All data is synthetic. Dag 145 in Nayapara — Rahim holds 20 decimals.”*

### 0:25–1:05 · G1 — the double sale is blocked (3 cards, press “পরের ধাপ”)

*Screen:* card “বায়না নিবন্ধন” (green) → card “একই জমি দুইবার বিক্রি — আটকে গেল” (red, reason) →
card “বৈধ বিক্রি” (green, mutation case number). Optionally cut to `/registry` for 3 seconds to show
the SMS and mutation list.

> “রহিম ১০ শতক সালমাকে বায়না দিলেন — লেজারে ওই অংশ আটকে গেল। এখন একই জমি জামালের কাছে ১৫ শতক বিক্রির চেষ্টা — সিস্টেম সঙ্গে সঙ্গে আটকে দিল, কারণ বিক্রয়যোগ্য মাত্র ১০ শতক। বাকি ১০ শতকের বৈধ বিক্রি হলো, নামজারি মামলা নিজে থেকেই খুলল।”
>
> *“Rahim gives a 10-decimal baina to Salma — the ledger locks it. Selling 15 decimals of the same land to Jamal is blocked at once: only 10 are sellable. The honest 10-decimal sale goes through and a mutation case opens by itself.”*

### 1:05–1:30 · G3 — reading a deed

*Screen:* card “দলিল পড়া” (amber): plain summary + “খতিয়ানে ম্যাপের চেয়ে ৩ শতক বেশি”.

> “দলিলের একটা ছবি — সাথী সহজ বাংলায় বুঝিয়ে দিল, আর রেকর্ড ও ম্যাপের সাথে মিলিয়ে দেখল: খতিয়ানে ৩ শতক বেশি লেখা। আমিন দিয়ে সীমানা মাপুন।”
>
> *“One photo of a deed — Sathi explains it in plain Bangla and checks it against the records and the map: the khatian says 3 decimals more. Have a surveyor check the boundary.”*

### 1:30–1:55 · G8 — Sathi AI

*Screen:* card “সাথী এআই” (red) with the answer. Optional 5-second cut to `/chat`, pressing the
microphone and saying “১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও”, the read-back
“আপনি কি ১৪৫ বলেছেন?”, and the spoken answer.

> “বাংলায় লিখে বা বলে প্রশ্ন করুন। সাথী নিজে যাচাই টুল চালায়, আইনের ধারা উল্লেখ করে উত্তর দেয় — আর আপনার ‘হ্যাঁ’ ছাড়া কখনও কিছু নিবন্ধন করে না।”
>
> *“Ask in Bangla, typed or spoken. Sathi runs the same check itself, cites the law — and never records anything without your ‘yes’.”*

### 1:55–2:20 · G2 — inheritance, women's share protected

*Screen:* card “ওয়ারিশ হিসাব”: wife, two sons, daughter — decimals on each dag.

> “আব্দুল করিম মারা গেছেন। ফারায়েজ অনুযায়ী স্ত্রী, দুই ছেলে আর মেয়ে — প্রত্যেকে প্রতিটি দাগে কত শতক পাবেন, তা হিসাব হলো। নারীর অংশ আইনে নির্ধারিত, কেউ বঞ্চিত করতে পারে না।”
>
> *“Abdul Karim has died. Faraid shares for his wife, two sons and daughter — in decimals on every plot. Women's shares are fixed by law; no one can take them away.”*

### 2:20–2:50 · G7 — the sealed report

*Screen:* card “সিলযুক্ত রিপোর্ট” with the QR and four green lights → final card
“পুরনো রিপোর্ট ধরা পড়ল” (amber). Optional: scan the QR with a second phone to show `/verify`.

> “জমির রিপোর্টে ডিজিটাল স্বাক্ষর — ব্যাংক বা ক্রেতা QR স্ক্যান করলে চারটি বাতি: আসল, হালনাগাদ, অক্ষত, অংশের যোগফল মেলে। এরপর নতুন বায়না হলে সেই পুরনো রিপোর্ট আর সবুজ নয় — হলুদ।”
>
> *“A digitally signed land report. A bank or buyer scans the QR: four lights — genuine, current, untouched, shares add up. After a new baina, the same old report is no longer green — it turns amber.”*

### 2:50–3:00 · Close

*Screen:* the “এক জমি, এক সত্য। ধন্যবাদ!” card, then the home page with the logo.

> “ভূমিসাথী — বাংলায়, ফোনে, সবার জন্য। এক জমি, এক সত্য।”
>
> *“BhumiSathi — in Bangla, on your phone, for everyone. One plot, one truth.”*

---

**On-screen note for the whole video (small, bottom):** “Prototype · synthetic data · not a
government website”.

**If a step shows a quota message** (free AI limit reached), skip to the next step — the tour
continues; or record the deed and chat steps separately from `/deed` and `/chat`.
