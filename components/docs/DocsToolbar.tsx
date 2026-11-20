"use client";

import { useState } from "react";

// Search (filters the sections on the page), print / save as PDF, and Markdown download.
export function DocsToolbar() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<number | null>(null);

  function filter(value: string) {
    setQ(value);
    const needle = value.trim().toLowerCase();
    let n = 0;
    document.querySelectorAll<HTMLElement>("[data-doc-section]").forEach((el) => {
      const show = !needle || el.innerText.toLowerCase().includes(needle);
      el.hidden = !show;
      if (show) n++;
    });
    setHits(needle ? n : null);
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 print:hidden sm:flex-row sm:items-center">
      <label className="flex-1">
        <span className="sr-only">Search the docs</span>
        <input
          type="search"
          value={q}
          onChange={(e) => filter(e.target.value)}
          placeholder="Search the docs (e.g. RAG, ledger, security)…"
          className="min-h-11 w-full rounded-lg border border-line bg-white px-3"
        />
      </label>
      <p aria-live="polite" className="text-sm text-ink-soft sm:w-28">
        {hits === null ? "" : `${hits} section${hits === 1 ? "" : "s"}`}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 rounded-lg bg-brand px-3 font-semibold text-white"
        >
          PDF / Print
        </button>
        <a
          href="/docs/markdown"
          download="bhumisathi-docs.md"
          className="inline-flex min-h-11 items-center rounded-lg border border-brand px-3 font-semibold text-brand-deep"
        >
          Markdown
        </a>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(location.origin + "/docs")}
          className="min-h-11 rounded-lg border border-line px-3"
        >
          Copy link
        </button>
      </div>
    </div>
  );
}
