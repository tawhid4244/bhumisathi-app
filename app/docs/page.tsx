import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DocsToolbar } from "@/components/docs/DocsToolbar";
import { currentUser } from "@/lib/auth/current";
import { SECTIONS, TEAM, type DocSection } from "@/lib/docs/content";
import { SurveyChart } from "@/components/docs/SurveyChart";
import { docsLive, docsOpen, getDocsSettings, khatiansBySurvey } from "@/lib/engines/docs";
import { mcpTools } from "@/lib/mcp/tools";
import { tools } from "@/lib/tools/registry";

export const metadata: Metadata = {
  title: "Docs — pitch deck & technical documentation",
  description: "BhumiSathi pitch deck, architecture, AI, data, security and live system numbers.",
};

export default function DocsPage() {
  return (
    <>
      <PageHeader
        titleBn="ডকুমেন্টেশন ও পিচ ডেক"
        titleEn="Docs: pitch deck & technical documentation"
        subtitleBn="দুই মিনিটে পণ্যটি বুঝুন, দশ মিনিটে সিস্টেমটি যাচাই করুন — লাইভ ডেটাসহ।"
        subtitleEn="Understand the product in 2 minutes, evaluate the system in 10 — with live data."
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-ink-soft">লোড হচ্ছে… Loading…</p>}>
          <Content />
        </Suspense>
      </main>
    </>
  );
}

async function Content() {
  await connection();
  const [user, settings] = await Promise.all([currentUser(), getDocsSettings()]);
  const isAdmin = user?.role === "admin";
  const open = docsOpen(settings);
  if (!open && !isAdmin) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-line bg-card p-6 text-center">
        <h2 className="text-xl font-bold">এখন পাওয়া যাচ্ছে না · Not available</h2>
        <p className="mt-2 text-ink-soft">
          The documentation is not published right now (403). Please check back during the published
          window.
        </p>
      </section>
    );
  }
  const [live, surveys] = await Promise.all([
    docsLive().catch(() => [] as [string, number][]),
    khatiansBySurvey().catch(() => []),
  ]);
  const mcp = mcpTools().length;
  const byKind = { read: tools.filter((t) => t.kind === "read").length, write: tools.filter((t) => t.kind === "write").length }; // prettier-ignore

  return (
    <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-8">
      <nav
        aria-label="Sections"
        className="mb-4 print:hidden lg:sticky lg:top-4 lg:mb-0 lg:self-start"
      >
        <ul className="flex gap-2 overflow-x-auto pb-2 text-sm lg:flex-col lg:gap-1 lg:overflow-visible">
          {[
            ["live", "Live system"],
            ...SECTIONS.map((s) => [s.id, s.title]),
            ["features", "Feature matrix"],
            ["team", "Team"],
          ].map(([id, t]) =>
            // prettier-ignore
            <li key={id} className="shrink-0">
              <a href={`#${id}`} className="inline-flex min-h-11 items-center rounded-lg px-2 hover:bg-brand-soft lg:min-h-9">
                {t}
              </a>
            </li>,
          )}
        </ul>
      </nav>

      <div className="min-w-0 space-y-6">
        {isAdmin && !open ? (
          <p role="status" className="rounded-xl border border-verdict-amber bg-white p-3 text-sm">
            Admin preview: this page is closed to the public right now. Change it in /admin → Docs
            publishing.
          </p>
        ) : null}
        <DocsToolbar />

        <section
          id="live"
          data-doc-section
          className="rounded-2xl border border-line bg-card p-5 shadow-sm"
        >
          <h2 className="text-xl font-bold">Live system</h2>
          <p className="text-sm text-ink-soft">
            Read from the production database when this page loads. All records are synthetic.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ...live,
              ["Tools in the registry", tools.length] as [string, number],
              ["Tools offered over MCP", mcp] as [string, number],
            ].map(([k, v]) =>
              // prettier-ignore
              <div key={k} className="rounded-xl bg-brand-soft p-3">
                <dt className="text-xs text-ink-soft">{k}</dt>
                <dd className="text-2xl font-bold text-brand-deep">{v}</dd>
              </div>,
            )}
          </dl>
          {surveys.length ? <SurveyChart data={surveys} /> : null}
        </section>

        {SECTIONS.map((s) => (
          <Section key={s.id} s={s} />
        ))}

        <section
          id="features"
          data-doc-section
          className="rounded-2xl border border-line bg-card p-5 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Technical</p>
          <h2 className="text-xl font-bold">Feature matrix (live from the tool registry)</h2>
          <p className="text-sm text-ink-soft">
            {tools.length} tools: {byKind.read} read, {byKind.write} write. The pages, the AI agent
            and the MCP server all call these.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3">
                    Tool
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    What it does
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Kind
                  </th>
                  <th scope="col" className="py-2">
                    Who
                  </th>
                </tr>
              </thead>
              <tbody>
                {tools.map((t) => (
                  <tr key={t.name} className="border-b border-line/60 align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{t.name}</td>
                    <td className="py-2 pr-3">{t.description.en}</td>
                    <td className="py-2 pr-3">
                      {t.kind === "write" ? "write (needs Yes)" : "read"}
                    </td>
                    <td className="py-2">{t.access ?? "public"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">
            <strong>Upcoming:</strong> MCP over HTTP for banks, read-only adapters to official land
            systems. <strong>Planned:</strong> SMS / offline mobile, multi-office approval, public
            Merkle log.
          </p>
        </section>

        <section
          id="team"
          data-doc-section
          className="rounded-2xl border border-line bg-card p-5 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Pitch deck</p>
          <h2 className="text-xl font-bold">Team ByteMates</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((m) => (
              <li key={m.name} className="flex gap-3 rounded-xl border border-line p-3">
                <span
                  aria-hidden="true"
                  className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white"
                >
                  {m.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-sm text-brand-deep">{m.role}</p>
                  <p className="text-sm text-ink-soft">{m.does}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-soft">
            Contact the team through the AI Builders Congress portal (emails are not published
            here).
          </p>
        </section>
      </div>
    </div>
  );
}

function Section({ s }: { s: DocSection }) {
  return (
    <section
      id={s.id}
      data-doc-section
      className="scroll-mt-4 rounded-2xl border border-line bg-card p-5 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{s.group}</p>
      <h2 className="text-xl font-bold">{s.title}</h2>
      {s.p?.map((p) => (
        <p key={p} className="mt-2">
          {p}
        </p>
      ))}
      {s.id === "architecture" ? (
        <Flow
          steps={[
            "Citizen / officer / bank agent",
            "Web UI · Sathi AI · MCP",
            "Tool registry (zod, roles, audit)",
            "Engines (ledger, rules, warish, seal)",
            "Postgres (RLS, row locks)",
          ]}
        />
      ) : null}
      {s.id === "dataflow" ? (
        <Flow
          steps={[
            "Input: voice, text, deed photo",
            "Mask NID / phone / names",
            "AI picks tools",
            "Engines compute · law RAG",
            "Bangla answer + sources",
            "Yes → ledger · audit log",
          ]}
        />
      ) : null}
      {s.list ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {s.list.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
      {s.rows ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {s.rows.map(([a, b]) => (
                <tr key={a} className="border-b border-line/60 align-top">
                  <th scope="row" className="py-2 pr-3 font-semibold">
                    {a}
                  </th>
                  <td className="py-2">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/** A simple left-to-right diagram (top-to-bottom on phones); no diagram library needed. */
function Flow({ steps }: { steps: string[] }) {
  return (
    <ol
      aria-label="Diagram"
      className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center"
    >
      {steps.map((st, i) => (
        <li key={st} className="flex flex-col items-center gap-2 sm:flex-row">
          <span className="rounded-xl border-2 border-brand bg-brand-soft px-3 py-2 text-center text-sm font-semibold text-brand-deep">
            {st}
          </span>
          {i < steps.length - 1 ? (
            <span aria-hidden="true" className="text-xl text-brand sm:rotate-0">
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
