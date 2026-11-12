/* Simple generic glyphs drawn for this project. Not taken from any product. */
type P = { className?: string; size?: number };
const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconStar = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  </svg>
);
export const IconCheck = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.7 2.7L16 9.8" />
  </svg>
);
export const IconMail = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3.5 7l8.5 6 8.5-6" />
  </svg>
);
export const IconShare = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M14 5l6 6-6 6M20 11H10a6 6 0 00-6 6v1" />
  </svg>
);
export const IconDots = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="6" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="18" cy="12" r="1" fill="currentColor" />
  </svg>
);
export const IconSearch = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);
export const IconHome = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 11l8-6.5 8 6.5V20h-5.5v-5h-5v5H4z" />
  </svg>
);
export const IconCalendar = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
export const IconChat = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 4c4.7 0 8.5 3.4 8.5 7.6S16.7 19.2 12 19.2c-1 0-2-.1-2.9-.4L5 20.5l1.1-3.6C4.6 15.6 3.5 13.7 3.5 11.6 3.5 7.4 7.3 4 12 4z" />
  </svg>
);
export const IconBell = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 16.5V11a6 6 0 1112 0v5.5l1.5 2h-15zM10 20.5a2 2 0 004 0" />
  </svg>
);
export const IconPin = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9 4h6l-1 5 3 3v1H7v-1l3-3zM12 13v7" />
  </svg>
);
export const IconSend = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12l16-8-6 16-2.5-6.5z" />
  </svg>
);
export const IconUsers = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5" />
    <circle cx="17" cy="9.5" r="2.5" />
    <path d="M16.5 14.6c2.4.1 4.3 1.6 5 4.4" />
  </svg>
);
export const IconGlobe = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z" />
  </svg>
);
export const IconMapPin = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1113 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);
export const IconClock = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconTicket = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7.5h16v3a1.8 1.8 0 000 3v3H4v-3a1.8 1.8 0 000-3z" />
  </svg>
);
export const IconSparkle = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  </svg>
);
export const IconClose = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconDoor = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 20.5h14M7 20.5V4h10v16.5" />
    <circle cx="14" cy="12.5" r=".8" fill="currentColor" />
  </svg>
);
export const IconLock = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
  </svg>
);
