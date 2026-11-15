import { T } from "../i18n/LangProvider";

// Original hero illustration: a mouza sheet over paddy fields at sunrise. One plot is checked
// (green), one double sale is blocked (red) — the two things BhumiSathi does.
export function HeroArt() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <svg viewBox="0 0 400 300" className="w-full drop-shadow-xl">
        <defs>
          <linearGradient id="h-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFF4D6" />
            <stop offset="1" stopColor="#E8F5EC" />
          </linearGradient>
          <clipPath id="h-card">
            <rect width="400" height="300" rx="28" />
          </clipPath>
        </defs>
        <g clipPath="url(#h-card)">
          <rect width="400" height="300" fill="url(#h-sky)" />
          <g className="animate-rise">
            <circle cx="292" cy="118" r="46" fill="#F42A41" />
          </g>
          <path d="M0 150 C 90 120, 220 125, 400 145 L400 300 L0 300 Z" fill="#14915F" />
          <path d="M0 196 C 120 168, 260 172, 400 190 L400 300 L0 300 Z" fill="#2FA86E" />
          <path d="M0 246 C 130 222, 270 226, 400 240 L400 300 L0 300 Z" fill="#6CC27F" />
          {/* mouza sheet: plots */}
          <g stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" fill="none" opacity="0.95">
            <path d="M34 214 L120 182 L172 202 L92 240 Z" fill="#FFFFFF" fillOpacity="0.22" />
            <path d="M120 182 L196 160 L248 176 L172 202 Z" />
            <path d="M172 202 L248 176 L318 196 L236 232 Z" fill="#FFFFFF" fillOpacity="0.22" />
            <path d="M92 240 L172 202 L236 232 L150 276 Z" />
          </g>
          <path d="M77 196 L132 222" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="5 4" />
          {/* checked plot */}
          <circle cx="104" cy="204" r="15" fill="#FFFFFF" />
          <path
            d="M97 204 L102 209 L111 199"
            stroke="#067647"
            strokeWidth="3.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* blocked double sale */}
          <circle cx="250" cy="204" r="15" fill="#FFFFFF" />
          <path
            d="M244 198 L256 210 M256 198 L244 210"
            stroke="#B42318"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          {/* birds */}
          <path
            d="M70 70 q8 -8 16 0 q8 -8 16 0 M120 50 q6 -6 12 0 q6 -6 12 0"
            stroke="#3d5468"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            opacity="0.6"
          />
        </g>
      </svg>
      <div className="animate-float absolute -left-2 top-6 rounded-xl bg-card px-3 py-2 text-xs font-semibold text-ink shadow-lg sm:-left-6">
        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-verdict-green" />
        <T bn="দাগ ১৪১ · নিরাপদ" en="Dag 141 · safe" />
      </div>
      <div className="animate-float absolute -right-1 bottom-10 rounded-xl bg-card px-3 py-2 text-xs font-semibold text-ink shadow-lg [animation-delay:1.5s] sm:-right-5">
        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-verdict-red" />
        <T bn="দ্বিতীয় বিক্রি আটকানো" en="Second sale blocked" />
      </div>
    </div>
  );
}
