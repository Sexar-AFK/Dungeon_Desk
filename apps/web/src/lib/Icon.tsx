import type { ReactNode, SVGProps } from "react";

type IconName =
  | "dice"
  | "home"
  | "book"
  | "users"
  | "scroll"
  | "sparkles"
  | "chevrons"
  | "chevron"
  | "plus"
  | "search"
  | "bell"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up-right"
  | "more"
  | "calendar"
  | "clock"
  | "close"
  | "sun"
  | "moon";

const paths: Record<IconName, ReactNode> = {
  dice: (
    <>
      <path d="M7 3.5h10l4 7v3l-4 7H7l-4-7v-3l4-7Z" />
      <path d="m7 3.5 5 8.5 5-8.5M3 12h18m-14 8.5 5-9 5 9" />
      <circle cx="7" cy="8" r=".7" fill="currentColor" />
      <circle cx="17" cy="16" r=".7" fill="currentColor" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9M9 20v-6h6v6" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" />
      <path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20M8 7h8" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  scroll: (
    <>
      <path d="M8 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h1Z" />
      <path d="M8 3v14a2 2 0 0 0 2 2M11 8h5m-5 4h5" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14ZM5 2l.7 1.3L7 4l-1.3.7L5 6l-.7-1.3L3 4l1.3-.7L5 2Z" />
    </>
  ),
  chevrons: (
    <>
      <path d="m7 10 5-5 5 5M7 14l5 5 5-5" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M19 12H5m6 6-6-6 6-6" />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M7 17 17 7M7 7h10v10" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  close: (
    <>
      <path d="m18 6-12 12M6 6l12 12" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </>
  ),
  moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
};

/** Shared inline SVG icon set, so the UI does not need an icon-font request. */
export function Icon({
  name,
  size = 20,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
