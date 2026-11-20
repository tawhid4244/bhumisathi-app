// Content of the /docs page (pitch deck + technical documentation). One source of truth for
// the page and its Markdown export. Facts match docs/SUBMISSION.md and docs/ARCHITECTURE.md;
// live numbers (records, tools, audit entries) are added by the page from the database.

export interface DocSection {
  id: string;
  group: "Pitch deck" | "Technical";
  title: string;
  p?: string[];
  list?: string[];
  rows?: [string, string][];
}

export const TEAM = [
  { name: "Tawhid Ahmed", role: "Team Lead, AI/ML Engineer", does: "Vision, execution, milestones; AI agent and model choice" }, // prettier-ignore
  { name: "Mahmud Ibna Arif Akanda", role: "Full-Stack Developer", does: "Next.js app, APIs, database, deployment" }, // prettier-ignore
  { name: "Milon Kumar Baidya", role: "AI/ML Engineer", does: "RAG and law citations, deed reader, AI evaluation" }, // prettier-ignore
  { name: "Arpita Kundu", role: "Product/UX Designer", does: "Bangla-first UX, accessibility, product flows" }, // prettier-ignore
  { name: "Khadiza Akter Summa", role: "Domain Expert", does: "Land law, survey records, user problems, KPIs" }, // prettier-ignore
];

export const SECTIONS: DocSection[] = [
  {
    id: "problem",
    group: "Pitch deck",
    title: "Problem",
    p: [
      "Land is most Bangladeshi families' largest asset, yet almost 80% of court cases are land disputes. The same land is often sold to several buyers: over 12,000 plot and flat fraud cases are pending in Dhaka alone.",
      "A plot's record is split across four surveys (CS, SA, RS, BS), deeds, bainas, mortgages and mutation files in different offices. Citizens cannot read or connect them, so they depend on brokers and discover a double sale or hidden mortgage only after paying.",
    ],
  },
  {
    id: "solution",
    group: "Pitch deck",
    title: "Solution",
    list: [
      "Share ledger: each share of a plot can be promised or sold only once — checked in one database transaction with a row lock.",
      "Sathi AI: ask in Bangla, typed or spoken — is this land safe to buy, what does my deed say, what does the law say? Answers cite the law section.",
      "Signed QR land report (BhumiSeal): banks and buyers verify it is genuine, current and untouched.",
      "Land services in one place: mutation with hearing, land tax and receipts, certified copies, broker complaints, tracker, officer inbox.",
    ],
  },
  {
    id: "why-now",
    group: "Pitch deck",
    title: "Why now",
    list: [
      "Land services are moving online (e-mutation, online land tax, a land service gateway), so a citizen-facing layer can plug into official systems.",
      "LLMs now speak good Bangla and call tools reliably, so a voice-first assistant for low-literacy users is practical.",
      "Free-tier AI and serverless hosting make a free citizen service affordable.",
    ],
  },
  {
    id: "demo",
    group: "Pitch deck",
    title: "Product demo",
    list: [
      "Judge mode (no account): /judge — a 3-minute guided tour of every flow.",
      "Check a plot without an account: /check — dag 141 (green), 142 (court case → red), 145.",
      "Pitch video (3 min) and live app linked from the submission. All data is synthetic.",
    ],
  },
  {
    id: "market",
    group: "Pitch deck",
    title: "Market opportunity",
    list: [
      "Every land buyer, seller and heir in Bangladesh — land is the most common family asset.",
      "Banks and NBFIs that take land as loan collateral and must catch land mortgaged twice.",
      "Sub-registry and AC Land offices that need faster, auditable service delivery.",
      "The same model fits other countries with fragmented land records.",
    ],
  },
  {
    id: "business",
    group: "Pitch deck",
    title: "Business model",
    p: ["Proposed, not yet validated with customers."],
    rows: [
      ["Citizens", "Free: check, chat, inheritance, complaints (public-good layer)"],
      ["Buyers, banks, NBFIs", "Fee per signed report or per collateral check"],
      ["Banks and sub-registries", "API: pay-per-call or subscription"],
      ["Land offices (B2G)", "Licence for officer inbox, mutation workflow and audit log"],
    ],
  },
  {
    id: "traction",
    group: "Pitch deck",
    title: "Traction",
    list: [
      "Working prototype live on Vercel with 11 golden scenarios tested end to end.",
      "Measured: 100% of double-sale attempts blocked in tests; plot check in under 1 s (fast path 0.02 s); AI answer time cut from 70 s to 3.7 s.",
      "AI evaluation on 20 held-out questions: correct tool 90%, right citation 88%, correct refusal 100%.",
      "No real users yet — next step is a one-upazila pilot.",
    ],
  },
  {
    id: "competition",
    group: "Pitch deck",
    title: "Competition",
    rows: [
      ["Brokers (dalal)", "Fast for the citizen, but costly, opaque and a source of fraud"],
      [
        "Government portals",
        "Official records and services, but separate systems, no share-level double-sale check, hard for low-literacy users",
      ],
      ["Lawyers", "Trusted advice, but expensive and slow for a first check"],
      ["BhumiSathi", "One Bangla voice-first place: share ledger + cited AI + signed reports"],
    ],
  },
  {
    id: "advantage",
    group: "Pitch deck",
    title: "Unique advantage",
    list: [
      "Code decides, AI explains: facts come from engines, never from the model — so the AI cannot invent ownership.",
      "Share-level ledger: blocks the double sale before money changes hands.",
      "Bangla voice with number read-back for low-literacy citizens.",
      "One typed tool registry serves the web app, the AI agent and an MCP server for other agents.",
    ],
  },
  {
    id: "gtm",
    group: "Pitch deck",
    title: "Go-to-market",
    list: [
      "Pilot with one upazila land office and its sub-registry.",
      "Partner with banks for collateral checks (paid reports fund the free citizen layer).",
      "Then district and national rollout, with SMS and offline-first mobile for low bandwidth.",
    ],
  },
  {
    id: "vision",
    group: "Pitch deck",
    title: "Vision",
    p: [
      "Every plot checked before purchase, land services without brokers, and double sales down to zero. এক জমি, এক সত্য — one plot, one truth.",
    ],
  },
  {
    id: "overview",
    group: "Technical",
    title: "Product overview",
    rows: [
      ["What it does", "Land check, cited Bangla AI help, signed reports, land services"],
      ["Target users", "Buyers, sellers, heirs, banks, sub-registry and AC Land offices"],
      [
        "Core use cases",
        "Check before buying · understand a deed · inheritance shares · mutation and land tax · report a broker",
      ],
    ],
  },
  {
    id: "architecture",
    group: "Technical",
    title: "Architecture",
    p: [
      "One Next.js app. Every capability is one typed engine function exposed through one tool in lib/tools/registry.ts; pages, the API, the Sathi AI agent and the MCP server all call the same tools. Ledger writes go only through the Postgres function register_event() in one transaction with the dag row locked.",
    ],
  },
  {
    id: "dataflow",
    group: "Technical",
    title: "Data flow",
    p: [
      "Input (Bangla voice/text, deed photo, dag number) → PII masking → Sathi agent picks typed tools → engines compute from the ledger and records; law search retrieves cited sections → AI explains in Bangla with sources → citizen confirms any action with Yes → audit log; signed QR report for third parties.",
    ],
  },
  {
    id: "stack",
    group: "Technical",
    title: "Technology stack",
    rows: [
      [
        "Frontend",
        "Next.js (App Router), React, TypeScript strict, Tailwind CSS, Hind Siliguri + IBM Plex Sans",
      ],
      ["Backend", "Next.js API routes, zod-validated tool registry, Node crypto (Ed25519)"],
      ["Database", "PostgreSQL on Supabase (Singapore), Row Level Security, postgres.js"],
      [
        "AI",
        "Gemini Flash-Lite (first) + Flash (fallback), Gemini vision, Gemini embeddings; Claude via adapter",
      ],
      ["Voice", "Web Speech API (bn-BD) + speech synthesis, Bangla number parser"],
      ["Infra", "Vercel (sin1), GitHub; tests: Vitest, Playwright + axe-core"],
      ["Agents", "MCP server over stdio (npm run mcp) with 10 read-only tools"],
    ],
  },
  {
    id: "api",
    group: "Technical",
    title: "API documentation",
    rows: [
      [
        "POST /api/tools/{name}",
        "Run any registry tool; role checked per tool; JSON in/out validated with zod",
      ],
      ["POST /api/agent, /api/agent/stream", "Sathi AI (signed-in users; 15 turns/min, 300/day)"],
      ["POST /api/deed/upload", "Private deed photo upload (PNG/JPEG/WebP, max 5 MB)"],
      ["GET /api/seal/key", "Public key to verify signed reports"],
      ["GET /api/health", "Health check (yes/no only)"],
      [
        "POST /api/auth/login, /logout · GET /api/auth/me",
        "Session auth (HTTP-only cookie, lockout after failed logins)",
      ],
      [
        "MCP (stdio)",
        "jomi_check, law_search, find_dag, map_area, fee_guide, unit_convert, warish_compute, land_tax_due, seal_verify, application_track",
      ],
      ["APIs used", "Gemini API; government systems mocked behind adapters (lib/adapters)"],
    ],
  },
  {
    id: "data",
    group: "Technical",
    title: "Data layer",
    list: [
      "100% synthetic records (is_synthetic = true; NIDs like SYN-0000-0001), deterministic seed 2026.",
      "Law library: 11 hand-copied, cited law sections + a Q&A set; no scraping, no calls to government sites.",
      "Storage: one Postgres database — ledger, records, private uploads, embeddings keyed by content hash, audit log.",
      "Privacy: NID, phone and names masked before the AI; RLS on every table; no public file URLs.",
    ],
  },
  {
    id: "ai",
    group: "Technical",
    title: "AI layer",
    list: [
      "Agent: Gemini function calling over typed tools, max 8 steps; deterministic fast path for common questions (no model call).",
      "RAG: hybrid search (0.6 embedding + 0.4 Bangla-aware keyword), abstains below a relevance threshold.",
      "Explainability: every answer lists the tool calls and law sections it used; legal answers end with “সূত্র: <Act>, ধারা <n>”.",
      "Safety: AI never writes the ledger — the citizen's Yes and an officer role are required; uploaded documents are data-only.",
      "Evaluation: 20 held-out questions graded by code (npm run eval:ai).",
    ],
  },
  {
    id: "roadmap",
    group: "Technical",
    title: "Product roadmap",
    rows: [
      [
        "Short term",
        "One-upazila pilot; read-only adapters to official land systems; MCP over HTTP for banks",
      ],
      ["Mid term", "District rollout; SMS and offline-first mobile; multi-office approval"],
      [
        "Long term",
        "National scale; public Merkle log of seals and ledger events; escrow; other succession laws",
      ],
    ],
  },
  {
    id: "performance",
    group: "Technical",
    title: "Performance & scalability",
    list: [
      "Stateless serverless API + Postgres; scale with read replicas and caching.",
      "Fast path answers common questions in ~0.02 s; quick model first, larger model as fallback.",
      "Per-user AI rate limits protect cost and free quota; embeddings computed once per text change.",
    ],
  },
  {
    id: "security",
    group: "Technical",
    title: "Security",
    list: [
      "Auth: sessions in HTTP-only cookies, hashed passwords, lockout after failed logins.",
      "RBAC: public, citizen, officer, admin — checked on every tool call.",
      "Data protection: RLS on every table, private uploads, secrets only in environment variables.",
      "Integrity: hash-chained audit log; Ed25519-signed QR reports.",
    ],
  },
  {
    id: "changelog",
    group: "Technical",
    title: "Changelog",
    rows: [
      [
        "2026-11-14",
        "Foundation: schema, synthetic seed, share ledger with row lock, Jomi Check, sub-registry demo",
      ],
      [
        "2026-11-15",
        "Sathi AI agent, law RAG with citations, Bangla voice, deed reader, signed reports, security, deploy",
      ],
      [
        "2026-11-17",
        "Land services: mutation with hearing, land tax and receipts, complaints, officer inbox",
      ],
      [
        "2026-11-20",
        "MCP server for other AI agents; live /docs page with admin publishing control",
      ],
    ],
  },
];

/** Markdown export of the same content (live numbers appended by the caller). */
export function toMarkdown(live: [string, string | number][]): string {
  const out = ["# BhumiSathi (ভূমিসাথী) — pitch deck and technical documentation", ""];
  out.push(
    "Team ByteMates · International AI Builders Congress 2026 · prototype with synthetic data",
    "",
  );
  out.push("## Live system", "", ...live.map(([k, v]) => `- ${k}: ${v}`), "");
  for (const s of SECTIONS) {
    out.push(`## ${s.title}`, "");
    for (const p of s.p ?? []) out.push(p, "");
    if (s.list) out.push(...s.list.map((l) => `- ${l}`), "");
    if (s.rows) out.push("| | |", "|---|---|", ...s.rows.map(([a, b]) => `| ${a} | ${b} |`), "");
  }
  out.push("## Team", "", ...TEAM.map((m) => `- **${m.name}** — ${m.role}: ${m.does}`), "");
  return out.join("\n");
}
