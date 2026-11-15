"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MapAreaResult, MouzaMapData } from "@/lib/engines/map";
import { useLang, useNum } from "../i18n/LangProvider";

// Interactive mouza map: tap a dag (or type its number) to see its area from the map, compared
// with the khatian. The numbers come from the map_area tool, the same one Sathi AI uses.

export function MouzaMap({
  map,
  initial,
}: {
  map: MouzaMapData;
  /** Opened with ?dag=…: that dag is selected and measured on the server. */
  initial?: MapAreaResult | null;
}) {
  const [selected, setSelected] = useState<number | null>(initial?.dag_no ?? null);
  const [typed, setTyped] = useState("");
  const [info, setInfo] = useState<MapAreaResult | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const { t, lang } = useLang();
  const en = lang === "en";
  const bn = useNum();
  const dec = (n: number | string) => t(`${bn(n)} শতক`, `${bn(n)} dec`);

  // Fit the drawing: view box around all dags with a margin.
  const box = useMemo(() => {
    const xs = map.dags.flatMap((d) => d.points.map((p) => p[0]));
    const ys = map.dags.flatMap((d) => d.points.map((p) => p[1]));
    const pad = 30;
    const x = Math.min(...xs) - pad;
    const y = Math.min(...ys) - pad;
    return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad };
  }, [map]);

  async function select(dagNo: number) {
    setSelected(dagNo);
    setError(null);
    const res = await fetch("/api/tools/map_area", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mouza: map.mouza_en, dag_no: dagNo }),
    });
    const json = await res.json();
    if (!res.ok) {
      setInfo(null);
      setError(
        (en ? json?.error?.en : json?.error?.bn) ??
          t("এই দাগ ম্যাপে নেই।", "This dag is not on the map."),
      );
      return;
    }
    setInfo(json as MapAreaResult);
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(typed.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));
    if (Number.isInteger(n) && n > 0) void select(n);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSearch} className="flex gap-2">
        <label className="sr-only" htmlFor="dag-search">
          {t("দাগ নম্বর", "Dag number")}
        </label>
        <input
          id="dag-search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          inputMode="numeric"
          placeholder={`${t("দাগ নম্বর", "Dag number")} (${bn(map.dags[0]!.dag_no)}–${bn(map.dags.at(-1)!.dag_no)})`}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-base"
        />
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-brand px-4 font-semibold text-white"
        >
          {t("দেখুন", "Show")}
        </button>
      </form>

      <figure className="rounded-xl border border-line bg-white p-2">
        <svg
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          className="h-auto w-full"
          role="group"
          aria-label={t(`${map.mouza_bn} মৌজার ম্যাপ`, `Map of ${map.mouza_en} mouza`)}
        >
          <defs>
            <pattern
              id="khas"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="16" height="16" fill="#fde8e6" />
              <line x1="0" y1="0" x2="0" y2="16" stroke="#b42318" strokeWidth="6" opacity="0.45" />
            </pattern>
          </defs>
          {map.dags.map((d) => {
            const isSel = d.dag_no === selected;
            const fill = d.is_khas ? "url(#khas)" : isSel ? "#bfe3d6" : "#f3efe2";
            const stroke = isSel ? "#13795b" : d.mismatch ? "#b54708" : "#5b6b78";
            return (
              <g
                key={d.dag_no}
                role="button"
                tabIndex={0}
                aria-pressed={isSel}
                aria-label={`${t("দাগ", "Dag")} ${bn(d.dag_no)}${d.is_khas ? t(", খাস জমি", ", khas land") : ""}${d.mismatch ? t(", খতিয়ানের সাথে মাপে অমিল", ", area differs from the khatian") : ""}`}
                data-dag={d.dag_no}
                onClick={() => select(d.dag_no)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void select(d.dag_no);
                  }
                }}
                className="cursor-pointer outline-none [&:focus-visible>polygon]:stroke-[#0f2a44] [&:focus-visible>polygon]:stroke-[8]"
              >
                <polygon
                  points={d.points.map((p) => p.join(",")).join(" ")}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSel || d.mismatch ? 6 : 3}
                  strokeDasharray={d.mismatch && !isSel ? "14 8" : undefined}
                />
                <text
                  x={d.label_at[0]}
                  y={d.label_at[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="34"
                  fontWeight="700"
                  fill="#0f2a44"
                  pointerEvents="none"
                >
                  {bn(d.dag_no)}
                </text>
              </g>
            );
          })}
        </svg>
        <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          <span>
            {t(
              `${map.mouza_bn} মৌজা, জেএল ${bn(map.jl_no)} · স্কেল ১৬ ইঞ্চি = ১ মাইল`,
              `${map.mouza_en} mouza, JL ${map.jl_no} · scale 16 inches = 1 mile`,
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-4 bg-[repeating-linear-gradient(45deg,#fde8e6_0,#fde8e6_3px,#e8a39b_3px,#e8a39b_6px)]" />{" "}
            {t("খাস জমি", "Khas land")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-4 border-2 border-dashed border-verdict-amber" />{" "}
            {t("খতিয়ানের সাথে মাপে অমিল", "Area differs from the khatian")}
          </span>
        </figcaption>
      </figure>

      {error ? (
        <p role="alert" className="rounded-xl border border-verdict-amber/40 bg-amber-50 p-3">
          {error}
        </p>
      ) : null}

      {info ? (
        <section
          className="space-y-3 rounded-xl border border-line bg-card p-4"
          aria-live="polite"
          data-testid="map-info"
        >
          <h2 className="text-lg font-semibold">
            {en ? `${info.mouza_en} dag ${info.dag_no}` : `${info.mouza_bn} দাগ ${bn(info.dag_no)}`}
          </h2>
          {info.is_khas ? (
            <p
              className="rounded-lg bg-verdict-red p-2 font-semibold text-white"
              data-testid="khas-flag"
            >
              {t(
                "খাস (সরকারি) জমি — কেনা-বেচা করা যায় না",
                "Khas (government) land — cannot be bought or sold",
              )}
            </p>
          ) : null}
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {(
              [
                [t("শতক", "Decimals"), info.units.decimals],
                [t("কাঠা", "Katha"), info.units.katha],
                [
                  t(
                    `বিঘা (${bn(info.units.bigha_dec)} শতক)`,
                    `Bigha (${info.units.bigha_dec} dec)`,
                  ),
                  info.units.bigha,
                ],
                [t("একর", "Acres"), info.units.acre],
                [t("বর্গফুট", "Square feet"), info.units.sqft.toLocaleString("en-IN")],
                [t("বর্গমিটার", "Square metres"), info.units.sqm],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="rounded-lg bg-paper p-2">
                <dt className="text-xs text-ink-soft">{label}</dt>
                <dd className="font-semibold" data-unit={label}>
                  {bn(String(v))}
                </dd>
              </div>
            ))}
          </dl>
          <p
            className={`rounded-lg p-2 text-sm ${info.matches_khatian ? "bg-brand-soft" : "bg-amber-50"}`}
            data-testid="khatian-compare"
          >
            {t("ম্যাপে", "On the map")} <strong>{dec(info.map_area_dec)}</strong>,{" "}
            {t("খতিয়ানে", "on the khatian")} <strong>{dec(info.recorded_area_dec)}</strong> —{" "}
            {info.matches_khatian
              ? t("প্রায় মিলেছে।", "about the same.")
              : t(
                  `পার্থক্য ${bn(Math.abs(info.difference_dec))} শতক; আমিন দিয়ে সীমানা যাচাই করুন।`,
                  `a difference of ${Math.abs(info.difference_dec)} dec; have an amin (surveyor) check the boundary.`,
                )}
          </p>
          <p className="text-xs text-ink-soft">{info.note_bn}</p>
          <Link
            href={`/check?mouza=${info.mouza_en.toLowerCase()}&by=dag&no=${info.dag_no}`}
            className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 font-semibold text-white"
          >
            {t("এই দাগের জমি যাচাই →", "Check this dag →")}
          </Link>
        </section>
      ) : (
        <p className="text-sm text-ink-soft">
          {t(
            "ম্যাপে একটি দাগে চাপ দিন বা দাগ নম্বর লিখুন।",
            "Tap a dag on the map or type its number.",
          )}
        </p>
      )}
    </div>
  );
}
