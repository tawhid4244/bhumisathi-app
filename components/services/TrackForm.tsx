"use client";

import { useState } from "react";
import { T, useLang, useNum } from "../i18n/LangProvider";
import { StatusBadge } from "./Status";

// Public tracker: an application number → its status. Shows no names and no land details.

interface Tracked {
  app_no: string;
  type_bn: string;
  type_en: string;
  status: string;
  submitted_on: string;
  updated_on: string;
  due_on: string | null;
}

export function TrackForm({ initial = "" }: { initial?: string }) {
  const { t, lang } = useLang();
  const num = useNum();
  const [no, setNo] = useState(initial);
  const [result, setResult] = useState<Tracked | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function track(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tools/application_track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app_no: no.trim() }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setResult(undefined);
      setError(res.status === 400 ? t("নম্বরটি এমন হবে: CPY-2026-0001", "The number looks like CPY-2026-0001") : json?.error ? (lang === "en" ? json.error.en : json.error.bn) : t("দুঃখিত, সমস্যা হয়েছে।", "Sorry, something went wrong.")); // prettier-ignore
      return;
    }
    setResult(json);
  }

  return (
    <div className="grid gap-4">
      <form
        onSubmit={track}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-card p-4"
      >
        <label className="grid flex-1 gap-1 text-sm font-medium">
          {t("আবেদন নম্বর", "Application number")}
          <input
            value={no}
            onChange={(e) => setNo(e.target.value)}
            placeholder="CPY-2026-0001"
            autoCapitalize="characters"
            lang="en"
            className="min-h-11 rounded-lg border border-line bg-white px-3 text-base uppercase"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !no.trim()}
          className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white disabled:opacity-60"
        >
          {t("অবস্থা দেখুন", "Track")}
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-verdict-red">
          {error}
        </p>
      ) : null}
      {result === null ? (
        <p role="status" className="rounded-xl border border-line bg-card p-4">
          {t("এই নম্বরে কোনো আবেদন পাওয়া যায়নি।", "No application with this number.")}
        </p>
      ) : result ? (
        <section
          role="status"
          className="rounded-xl border border-line bg-card p-4"
          data-testid="track-result"
        >
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span lang="en">{result.app_no}</span> · <T bn={result.type_bn} en={result.type_en} />
          </p>
          <p className="mt-2">
            <StatusBadge status={result.status} />
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-soft">{t("জমা", "Submitted")}</dt>
              <dd>{num(result.submitted_on)}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">{t("সর্বশেষ", "Last update")}</dt>
              <dd>{num(result.updated_on)}</dd>
            </div>
            {result.due_on ? (
              <div>
                <dt className="text-ink-soft">{t("সিদ্ধান্তের শেষ তারিখ", "Decision due")}</dt>
                <dd>{num(result.due_on)}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
