"use client";

import { STATUS_LABEL, type Step } from "@/lib/services/catalog";
import { T, useNum } from "../i18n/LangProvider";

// Status pill and progress stepper for an application (used on /my, the tracker and /track).

const TONE = {
  amber: "bg-amber-100 text-amber-900 border-amber-300",
  blue: "bg-blue-50 text-blue-900 border-blue-200",
  green: "bg-green-50 text-green-900 border-green-300",
  red: "bg-red-50 text-red-900 border-red-300",
  grey: "bg-gray-100 text-gray-700 border-gray-300",
} as const;

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { bn: status, en: status, tone: "grey" as const };
  return (
    <span
      data-testid="status"
      data-status={status}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold ${TONE[s.tone]}`}
    >
      <T bn={s.bn} en={s.en} />
    </span>
  );
}

/** How many steps are done for a status (applied → paid → review → decision → document). */
export function stepsDone(status: string): number {
  switch (status) {
    case "payment_due":
      return 1;
    case "in_review":
      return 2;
    case "completed":
      return 5;
    case "rejected":
      return 4;
    default:
      return 1;
  }
}

export function Stepper({ steps, status }: { steps: Step[]; status: string }) {
  const num = useNum();
  const done = stepsDone(status);
  const failed = status === "rejected";
  const stopped = status === "cancelled";
  return (
    <ol className="flex items-start gap-1" aria-label="ধাপ / Steps">
      {steps.map((s, i) => {
        const isDone = i < done;
        const isFail = failed && i === done - 1;
        const isNow = !stopped && !failed && i === done && status !== "completed";
        const dot = isFail
          ? "bg-verdict-red text-white"
          : isDone
            ? "bg-verdict-green text-white"
            : isNow
              ? "bg-white text-brand-deep ring-2 ring-brand animate-pulse"
              : "bg-gray-200 text-gray-600";
        return (
          <li
            key={s.key}
            className="flex min-w-0 flex-1 flex-col items-center text-center"
            aria-current={isNow ? "step" : undefined}
          >
            <div className="flex w-full items-center">
              <span
                className={`h-0.5 flex-1 ${i === 0 ? "invisible" : isDone || isNow ? "bg-verdict-green" : "bg-gray-200"}`}
              />
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${dot}`}
              >
                {isFail ? "✕" : isDone ? "✓" : num(i + 1)}
              </span>
              <span
                className={`h-0.5 flex-1 ${i === steps.length - 1 ? "invisible" : i < done - 1 ? "bg-verdict-green" : "bg-gray-200"}`}
              />
            </div>
            <span
              className={`mt-1 text-xs leading-tight ${isNow ? "font-semibold text-brand-deep" : "text-ink-soft"}`}
            >
              <T bn={s.bn} en={s.en} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
