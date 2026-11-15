"use client";

import { useRef, useState } from "react";
import { calibratedAreaDecimals, type Point } from "@/lib/engines/area";
import { useLang, useNum } from "../i18n/LangProvider";
import { fromDecimals } from "@/lib/engines/units";

// "Measure on your own map": the image never leaves the phone (no upload to the server).
// 1) click two points a known distance apart, 2) enter that distance, 3) click the plot's corners.

const UNIT_FEET = { ft: 1, m: 3.28084, chain: 66, link: 0.66 } as const;
type Unit = keyof typeof UNIT_FEET;
const UNIT_BN: Record<Unit, string> = {
  ft: "ফুট",
  m: "মিটার",
  chain: "চেইন (৬৬ ফুট)",
  link: "লিংক (০.৬৬ ফুট)",
};
const UNIT_EN: Record<Unit, string> = {
  ft: "feet",
  m: "metres",
  chain: "chain (66 ft)",
  link: "link (0.66 ft)",
};

export function UploadMeasure() {
  const [src, setSrc] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [calib, setCalib] = useState<Point[]>([]);
  const [distance, setDistance] = useState("");
  const [unit, setUnit] = useState<Unit>("ft");
  const [corners, setCorners] = useState<Point[]>([]);
  const [done, setDone] = useState(false);
  const { t, lang } = useLang();
  const en = lang === "en";
  const bn = useNum();
  const svgRef = useRef<SVGSVGElement>(null);

  const knownFeet = Number(distance.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))) * UNIT_FEET[unit]; // prettier-ignore
  const calibrated = calib.length === 2 && knownFeet > 0;
  const step = !src ? 0 : calib.length < 2 ? 1 : !calibrated ? 2 : 3;

  function reset(all = false) {
    setCalib([]);
    setCorners([]);
    setDone(false);
    if (all) {
      setSrc(null);
      setSize(null);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    reset(true);
    setSrc(URL.createObjectURL(f));
  }

  /** Click position in image pixels (the SVG uses the image's own pixel size as its view box). */
  function toImage(e: React.MouseEvent<SVGSVGElement>): Point | null {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  function onClick(e: React.MouseEvent<SVGSVGElement>) {
    const p = toImage(e);
    if (!p || done) return;
    if (calib.length < 2) setCalib((c) => [...c, p]);
    else if (calibrated) setCorners((c) => [...c, p]);
  }

  let area: number | null = null;
  if (done && calibrated && corners.length >= 3) {
    area = calibratedAreaDecimals(corners, calib[0]!, calib[1]!, knownFeet);
  }
  const units = area != null ? fromDecimals(area) : null;
  const STEPS = [
    t("ম্যাপের ছবি দিন", "Give a photo of the map"),
    t("স্কেলের দুই প্রান্তে চাপ দিন", "Tap both ends of the scale"),
    t("দুই বিন্দুর আসল দূরত্ব লিখুন", "Type the real distance between the two points"),
    t("জমির কোণাগুলোতে একে একে চাপ দিন", "Tap the corners of the land one by one"),
  ];

  return (
    <div className="space-y-4">
      <ol className="grid gap-1 text-sm sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-lg border px-2 py-1 ${i === step ? "border-brand bg-brand-soft font-semibold" : "border-line"}`}
          >
            {bn(i + 1)}. {s}
          </li>
        ))}
      </ol>

      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-brand px-4 font-semibold text-white">
        {t("ম্যাপের ছবি বেছে নিন", "Choose a map photo")}
        <input type="file" accept="image/*" onChange={onFile} className="sr-only" />
      </label>
      <p className="text-xs text-ink-soft">
        {t(
          "ছবি আপনার ফোনেই থাকে, কোথাও পাঠানো হয় না।",
          "The photo stays on your phone; it is not sent anywhere.",
        )}
      </p>

      {src ? (
        // Sized by the picture, and never taller than the screen below the sticky header, so
        // every corner of the map can be tapped without scrolling it under the header.
        <div className="relative mx-auto w-fit max-w-full rounded-xl border border-line bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the user's own file */}
          <img
            src={src}
            alt={t("আপলোড করা ম্যাপ", "The uploaded map")}
            className="block h-auto max-h-[calc(100svh-8rem)] w-auto max-w-full rounded-xl"
            onLoad={(e) =>
              setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
          />
          {size ? (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${size.w} ${size.h}`}
              className="absolute inset-0 h-full w-full cursor-crosshair"
              onClick={onClick}
              data-testid="measure-surface"
              aria-label={t("ম্যাপের উপর চাপ দিয়ে বিন্দু বসান", "Tap on the map to place points")}
            >
              {calib.length ? (
                <polyline
                  points={calib.map((p) => p.join(",")).join(" ")}
                  fill="none"
                  stroke="#b42318"
                  strokeWidth={size.w / 200}
                />
              ) : null}
              {calib.map((p, i) => (
                <circle key={`c${i}`} cx={p[0]} cy={p[1]} r={size.w / 120} fill="#b42318" />
              ))}
              {corners.length ? (
                <polygon
                  points={corners.map((p) => p.join(",")).join(" ")}
                  fill={done ? "#13795b55" : "#13795b22"}
                  stroke="#13795b"
                  strokeWidth={size.w / 250}
                />
              ) : null}
              {corners.map((p, i) => (
                <circle key={`p${i}`} cx={p[0]} cy={p[1]} r={size.w / 140} fill="#13795b" />
              ))}
            </svg>
          ) : null}
        </div>
      ) : null}

      {calib.length === 2 ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm font-medium">
            {t("দুই লাল বিন্দুর আসল দূরত্ব", "Real distance between the two red points")}
            <input
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              inputMode="decimal"
              className="min-h-11 w-32 rounded-lg border border-line bg-white px-3"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {t("একক", "Unit")}
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              className="min-h-11 rounded-lg border border-line bg-white px-3"
            >
              {(Object.keys(UNIT_FEET) as Unit[]).map((u) => (
                <option key={u} value={u}>
                  {en ? UNIT_EN[u] : UNIT_BN[u]}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {src ? (
        <div className="flex flex-wrap gap-2">
          {calibrated && !done ? (
            <button
              type="button"
              disabled={corners.length < 3}
              onClick={() => setDone(true)}
              className="min-h-11 rounded-lg bg-ink px-4 font-semibold text-white disabled:opacity-50"
            >
              {t(`মাপ দেখুন (${bn(corners.length)}টি কোণ)`, `Show area (${corners.length} corners)`)}
            </button>
          ) : null}
          {corners.length && !done ? (
            <button
              type="button"
              onClick={() => setCorners((c) => c.slice(0, -1))}
              className="min-h-11 rounded-lg border border-line px-3"
            >
              {t("শেষ বিন্দু মুছুন", "Undo last point")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-11 rounded-lg border border-line px-3"
          >
            {t("আবার শুরু করুন", "Start again")}
          </button>
        </div>
      ) : null}

      {units ? (
        <section
          className="rounded-xl border-2 border-brand bg-card p-3"
          data-testid="measure-result"
          data-decimals={units.decimals}
        >
          <p className="text-lg font-semibold">
            {t(
              `আনুমানিক মাপ: ${bn(units.decimals)} শতক`,
              `Approximate area: ${units.decimals} decimals`,
            )}
          </p>
          <p className="text-sm">
            {en
              ? `${units.katha} katha · ${units.acre} acres · ${units.sqft.toLocaleString("en-IN")} sq ft · ${units.sqm} sq m`
              : `${bn(units.katha)} কাঠা · ${bn(units.acre)} একর · ${bn(units.sqft.toLocaleString("en-IN"))} বর্গফুট · ${bn(units.sqm)} বর্গমিটার`}
          </p>
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs">
            {t(
              "এটি ছবি থেকে আনুমানিক হিসাব, জরিপ নয়। ছবি বাঁকা বা ভাঁজ থাকলে মাপ ভুল হতে পারে। আইনি মাপের জন্য আমিন দিয়ে জরিপ করান।",
              "This is an estimate from a photo, not a survey. A tilted or folded photo gives a wrong area. For a legal measurement, have an amin survey the land.",
            )}
          </p>
        </section>
      ) : null}
    </div>
  );
}
