"use client";

import { useState, type ReactNode } from "react";
import { useLang } from "../i18n/LangProvider";

// Two views of the map page: the mouza map, and measuring on your own map photo.
export function MapTabs({ mouzaMap, upload }: { mouzaMap: ReactNode; upload: ReactNode }) {
  const [tab, setTab] = useState<"mouza" | "upload">("mouza");
  const { t } = useLang();
  const tabs = [
    ["mouza", t("মৌজা ম্যাপ", "Mouza map")],
    ["upload", t("নিজের ম্যাপে মাপুন", "Measure on your own map")],
  ] as const;
  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={t("ম্যাপ", "Map")}
        className="inline-flex rounded-lg border border-line bg-card p-0.5"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            id={`tab-${id}`}
            onClick={() => setTab(id)}
            className={`min-h-10 rounded-md px-3 text-sm ${tab === id ? "bg-ink text-white" : "text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panel-mouza" aria-labelledby="tab-mouza" hidden={tab !== "mouza"}>
        {mouzaMap}
      </div>
      <div role="tabpanel" id="panel-upload" aria-labelledby="tab-upload" hidden={tab !== "upload"}>
        {upload}
      </div>
    </div>
  );
}
