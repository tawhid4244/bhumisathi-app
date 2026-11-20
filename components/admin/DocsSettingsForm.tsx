"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DocsSettings } from "@/lib/engines/docs";
import { useLang } from "../i18n/LangProvider";

// datetime-local works in the browser's time zone; the server stores UTC.
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

export function DocsSettingsForm({ initial, open }: { initial: DocsSettings; open: boolean }) {
  const router = useRouter();
  const { t } = useLang();
  const [visible, setVisible] = useState(initial.visible);
  const [start, setStart] = useState(toLocal(initial.starts_at));
  const [end, setEnd] = useState(toLocal(initial.ends_at));
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/tools/docs_settings_update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visible, starts_at: toIso(start), ends_at: toIso(end) }),
    });
    setMsg(
      res.ok
        ? t("সংরক্ষিত হয়েছে।", "Saved.")
        : t("সংরক্ষণ হয়নি — তারিখ দেখুন।", "Not saved — check the dates."),
    );
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3" data-testid="docs-settings">
      <h3 className="font-semibold">{t("/docs প্রকাশ", "Docs publishing (/docs)")}</h3>
      <p className="text-sm">
        {t("এখন জনসাধারণের জন্য:", "Public right now:")}{" "}
        <strong>{open ? t("খোলা", "open") : t("বন্ধ", "closed")}</strong>
      </p>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
          className="size-5"
        />
        {t("/docs প্রকাশ করুন", "Publish /docs")}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          {t("শুরু (ঐচ্ছিক)", "Opens at (optional)")}
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-line px-2"
          />
        </label>
        <label className="block text-sm">
          {t("শেষ (ঐচ্ছিক)", "Closes at (optional)")}
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-line px-2"
          />
        </label>
      </div>
      <button type="submit" className="min-h-11 rounded-lg bg-brand px-4 font-semibold text-white">
        {t("সংরক্ষণ", "Save")}
      </button>
      {msg ? (
        <p role="status" className="text-sm">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
