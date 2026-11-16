// Simple line icons (24×24, stroke = currentColor), drawn for BhumiSathi. Decorative: aria-hidden.

type P = { className?: string };
const base = (className = "h-6 w-6") => ({
  viewBox: "0 0 24 24",
  className,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconCheckLand = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 17l6-3 6 3 6-3V5l-6 3-6-3-6 3z" />
    <path d="M9 14V5M15 17V8" />
    <circle cx="17.5" cy="17.5" r="3.5" fill="currentColor" stroke="none" opacity="0.15" />
    <path d="M16 17.6l1.1 1.1 2.2-2.4" />
  </svg>
);
export const IconChat = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 9h8M8 12.5h5" />
  </svg>
);
export const IconDeed = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4" />
  </svg>
);
export const IconMap = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 8l6-3 4 2 6-3v12l-6 3-4-2-6 3z" />
    <path d="M10 5v12M14 7v12" />
  </svg>
);
export const IconFamily = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="8" cy="7" r="2.5" />
    <circle cx="16" cy="7" r="2.5" />
    <circle cx="12" cy="14" r="2" />
    <path d="M4 20c0-3 2-5 4-5M20 20c0-3-2-5-4-5M9 21c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5" />
  </svg>
);
export const IconScale = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 20h16M6 20V9M18 20V9M12 4v16" />
    <path d="M6 9l-3 5h6zM18 9l-3 5h6zM6 9h12" />
  </svg>
);
export const IconTaka = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 7.5c1.5 0 2 1 2 2.5v4.5c0 1.5 1 2.5 2.5 2.5s3-1.5 3-3.5M8 11h7" />
  </svg>
);
export const IconForm = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4" />
  </svg>
);
export const IconInbox = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 13l2.5-8h11L20 13v6H4z" />
    <path d="M4 13h4.5l1 2h5l1-2H20" />
  </svg>
);
export const IconRegistry = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18" />
  </svg>
);
export const IconSeal = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
    <path d="M8.8 12.2l2.2 2.2 4.4-4.6" />
  </svg>
);
export const IconEye = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconPlay = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" />
  </svg>
);
export const IconPhone = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1C10.7 20 4 13.3 4 5a1 1 0 011-1z" />
  </svg>
);
export const IconArrow = ({ className }: P) => (
  <svg {...base(className ?? "h-5 w-5")}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconMenu = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconClose = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconShield = IconSeal;
export const IconLock = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 018 0v3" />
  </svg>
);
export const IconSpark = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
  </svg>
);
