/*
 * A drawn character for people without a photo: hair, skin and a smile picked from their name, wearing their
 * own colour on a light tint of it. Original artwork (no avatar library); colours here are content, like
 * covers. Deterministic, so the same person looks the same everywhere and server and client agree.
 */
const SKIN = ["#FBE0CF", "#F3C9A5", "#E2A87F", "#C68B5F", "#9C6643", "#6F4630"];
const HAIR = ["#2A201E", "#45302A", "#6A4630", "#9A5532", "#D9A95B", "#1E2433"];
const INK = "#2A2526";
const BLUSH = "#FF6F7D";
const CAP = "M17 30 C16 15 25 10 32 10 C40 10 48 15 47 30 C45 23 39 19.5 32 19.5 C25 19.5 19 23 17 30 Z";
/** [behind the head, over the forehead] */
const HAIRCUTS: [string, string][] = [
  ["", CAP],
  ["", "M17 31 C15 16 25 9.5 33 10 C42 10.5 49 17 47 31 C45 24 42 20 37 18.5 C33 22.5 24 24 17 31 Z"],
  ["", "M17 29 a6.5 6.5 0 0 1 4 -11 a7 7 0 0 1 11 -6 a7 7 0 0 1 11 6 a6.5 6.5 0 0 1 4 11 C44 23 39 20.5 32 20.5 C25 20.5 20 23 17 29 Z"],
  ["M26 9.5 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z", CAP],
  ["M15 30 C15 16 23 10 32 10 C41 10 49 16 49 30 L50 50 C44 53 20 53 14 50 Z", "M17 30 C16 16 25 11 32 11 C40 11 48 16 47 30 C42 25 37 21 33 19 C29 23 22 26 17 30 Z"],
  ["M15.5 31 C15 16 23 10 32 10 C41 10 49 16 48.5 31 L49 41 C45 43 19 43 15 41 Z", "M17 30 C16 16 25 11 32 11 C40 11 48 16 47 30 C44 25 38 22 32 22 C26 22 20 25 17 30 Z"],
  ["", "M17.5 28 C18 17 25 13 32 13 C39 13 46 17 46.5 28 C42 22.5 22 22.5 17.5 28 Z"],
];

/** FNV-1a over code points: stable across server and client. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (const ch of s) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function characterTraits(seed: string) {
  const h = hash(seed);
  const pick = <T,>(arr: T[], shift: number) => arr[(h >>> shift) % arr.length];
  return { skin: pick(SKIN, 0), hair: pick(HAIR, 5), haircut: pick(HAIRCUTS, 10), glasses: (h >>> 15) % 5 === 0, happy: (h >>> 18) % 3 === 0 };
}

export function Character({ seed, color }: { seed: string; color: string }) {
  const t = characterTraits(seed);
  const [back, front] = t.haircut;
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="block h-full w-full">
      {/* a light tint of their colour; color-mix works for hex and for CSS variables */}
      <rect width="64" height="64" style={{ fill: `color-mix(in srgb, ${color} 22%, white)` }} />
      {back && <path d={back} fill={t.hair} />}
      <path d="M10 64 C10 52 20 46 32 46 C44 46 54 52 54 64 Z" style={{ fill: color }} />
      <rect x="27" y="38" width="10" height="10" rx="4" fill={t.skin} />
      <circle cx="17" cy="32" r="3.4" fill={t.skin} />
      <circle cx="47" cy="32" r="3.4" fill={t.skin} />
      <ellipse cx="32" cy="30" rx="15" ry="16" fill={t.skin} />
      <path d={front} fill={t.hair} />
      {t.happy ? (
        <path d="M23.5 32 q3 -3 6 0 M34.5 32 q3 -3 6 0" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="26.5" cy="31.5" r="2.3" fill={INK} />
          <circle cx="37.5" cy="31.5" r="2.3" fill={INK} />
        </>
      )}
      {t.glasses && (
        <g stroke={INK} strokeWidth="1.6" fill="none">
          <circle cx="26.5" cy="31.5" r="4.6" />
          <circle cx="37.5" cy="31.5" r="4.6" />
          <path d="M31.1 31.5 h1.8" />
        </g>
      )}
      <circle cx="22.5" cy="37" r="2.6" fill={BLUSH} opacity=".28" />
      <circle cx="41.5" cy="37" r="2.6" fill={BLUSH} opacity=".28" />
      <path d="M28.5 38.5 q3.5 3.5 7 0" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
