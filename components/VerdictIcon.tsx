import type { Verdict } from "@/lib/engines/rules";

// Simple shapes as well as colours, so the verdict is clear to colour-blind users too:
// red = cross in a circle, amber = exclamation in a triangle, green = tick in a circle.
export function VerdictIcon({
  verdict,
  className = "h-10 w-10",
}: {
  verdict: Verdict;
  className?: string;
}) {
  if (verdict === "red") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 8l8 8M16 8l-8 8" strokeLinecap="round" />
      </svg>
    );
  }
  if (verdict === "amber") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      >
        <path d="M12 3l10 18H2L12 3z" strokeLinejoin="round" />
        <path d="M12 10v5" strokeLinecap="round" />
        <circle cx="12" cy="18" r="0.6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M7.5 12.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
