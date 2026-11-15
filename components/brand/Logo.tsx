// BhumiSathi logo: an original mark (not a government emblem).
// A green tile with a rising red sun, paddy-field rows, and a white land plot divided into shares
// with a tick: "one plot, one truth" — every share recorded, checked once.

export function LogoMark({
  className = "h-10 w-10",
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id="bs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B7A55" />
          <stop offset="1" stopColor="#005A3F" />
        </linearGradient>
        <clipPath id="bs-tile">
          <rect width="64" height="64" rx="16" />
        </clipPath>
      </defs>
      <g clipPath="url(#bs-tile)">
        <rect width="64" height="64" fill="url(#bs-sky)" />
        {/* rising sun */}
        <circle cx="40" cy="31" r="11" fill="#F42A41" />
        {/* paddy rows */}
        <path d="M0 37 C 18 31, 38 31, 64 36 L64 64 L0 64 Z" fill="#14915F" />
        <path d="M0 47 C 20 41, 40 42, 64 46 L64 64 L0 64 Z" fill="#2FA86E" />
        <path d="M0 56 C 22 51, 42 52, 64 55 L64 64 L0 64 Z" fill="#6CC27F" />
        {/* the plot lying on the field, divided into two shares */}
        <path
          d="M8 45 L30 36.5 L56 43 L33 53.5 Z"
          fill="#FFFFFF"
          fillOpacity="0.2"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path d="M19 40.8 L44.5 48.3" stroke="#FFFFFF" strokeWidth="1.8" strokeDasharray="2.4 2" />
        {/* verified tick */}
        <circle cx="50.5" cy="46" r="7" fill="#FFFFFF" />
        <path
          d="M47.2 46.2 L49.8 48.8 L54.2 43.8"
          fill="none"
          stroke="#006A4E"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Mark + name. `tone="light"` for dark backgrounds. */
export function Logo({
  tone = "dark",
  showMotto = true,
}: {
  tone?: "dark" | "light";
  showMotto?: boolean;
}) {
  const main = tone === "light" ? "text-white" : "text-brand-deep";
  const sub = tone === "light" ? "text-white/75" : "text-ink-soft";
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className="h-11 w-11 shrink-0 drop-shadow-sm" />
      <span className="flex flex-col leading-none">
        <span className={`text-xl font-bold tracking-tight ${main}`}>ভূমিসাথী</span>
        <span
          lang="en"
          className={`mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${sub}`}
        >
          BhumiSathi
          {showMotto ? <span className="hidden sm:inline"> · one plot, one truth</span> : null}
        </span>
      </span>
    </span>
  );
}
