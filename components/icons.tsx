import React from "react";

/* Hairline geometric icon set — 1.5px strokes, no fills, currentColor. */

type P = { size?: number; className?: string; style?: React.CSSProperties };

function Svg({ size = 16, children, style, className }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Icon = {
  dashboard: (p: P) => <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Svg>,
  projects: (p: P) => <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></Svg>,
  puzzle: (p: P) => <Svg {...p}><path d="M9 4a2 2 0 0 1 4 0v1h3a1 1 0 0 1 1 1v3h1a2 2 0 0 1 0 4h-1v3a1 1 0 0 1-1 1h-3v-1a2 2 0 0 0-4 0v1H6a1 1 0 0 1-1-1v-3H4a2 2 0 0 1 0-4h1V6a1 1 0 0 1 1-1h3V4Z" /></Svg>,
  chat: (p: P) => <Svg {...p}><path d="M4 5h16v11H8l-4 4V5Z" /></Svg>,
  insight: (p: P) => <Svg {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.1V16h6v-.4c0-.8.4-1.5 1-2.1A6 6 0 0 0 12 3Z" /></Svg>,
  trend: (p: P) => <Svg {...p}><path d="M3 17l5-5 4 4 8-9" /><path d="M21 7h-5M21 7v5" /></Svg>,
  roadmap: (p: P) => <Svg {...p}><path d="M5 6h11M5 12h14M5 18h8" /><circle cx="19" cy="6" r="1.5" /><circle cx="19" cy="18" r="1.5" /></Svg>,
  bulb: (p: P) => <Svg {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.1V16h6v-.4c0-.8.4-1.5 1-2.1A6 6 0 0 0 12 3Z" /></Svg>,
  package: (p: P) => <Svg {...p}><path d="M12 3l8 4v10l-8 4-8-4V7l8-4Z" /><path d="M4 7l8 4 8-4M12 11v10" /></Svg>,
  target: (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></Svg>,
  star: (p: P) => <Svg {...p}><path d="M12 4l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16l-4.6 2.4.9-5.1L4.5 9.5l5.2-.8L12 4Z" /></Svg>,
  spark: (p: P) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></Svg>,
  refresh: (p: P) => <Svg {...p}><path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" /></Svg>,
  copy: (p: P) => <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>,
  check: (p: P) => <Svg {...p}><path d="M4 12l5 5L20 6" /></Svg>,
  chevron: (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>,
  arrowUp: (p: P) => <Svg {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>,
  arrowDown: (p: P) => <Svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Svg>,
  external: (p: P) => <Svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>,
  plus: (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>,
  trash: (p: P) => <Svg {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></Svg>,
  doc: (p: P) => <Svg {...p}><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5" /></Svg>,
  cog: (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Svg>,
  key: (p: P) => <Svg {...p}><circle cx="8" cy="8" r="4" /><path d="M11 11l8 8M16 16l2-2M19 19l2-2" /></Svg>,
};

export type IconName = keyof typeof Icon;
