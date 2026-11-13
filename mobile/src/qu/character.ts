/**
 * The drawn character from components/fb/Character.tsx on the web app, as an SVG string so the Expo app
 * shows the same person everywhere (same hash, same traits). Rendered as a data: URI image.
 */
const SKIN = ['#FBE0CF', '#F3C9A5', '#E2A87F', '#C68B5F', '#9C6643', '#6F4630'];
const HAIR = ['#2A201E', '#45302A', '#6A4630', '#9A5532', '#D9A95B', '#1E2433'];
const INK = '#2A2526';
const BLUSH = '#FF6F7D';
const CAP = 'M17 30 C16 15 25 10 32 10 C40 10 48 15 47 30 C45 23 39 19.5 32 19.5 C25 19.5 19 23 17 30 Z';
const HAIRCUTS: [string, string][] = [
  ['', CAP],
  ['', 'M17 31 C15 16 25 9.5 33 10 C42 10.5 49 17 47 31 C45 24 42 20 37 18.5 C33 22.5 24 24 17 31 Z'],
  ['', 'M17 29 a6.5 6.5 0 0 1 4 -11 a7 7 0 0 1 11 -6 a7 7 0 0 1 11 6 a6.5 6.5 0 0 1 4 11 C44 23 39 20.5 32 20.5 C25 20.5 20 23 17 29 Z'],
  ['M26 9.5 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z', CAP],
  ['M15 30 C15 16 23 10 32 10 C41 10 49 16 49 30 L50 50 C44 53 20 53 14 50 Z', 'M17 30 C16 16 25 11 32 11 C40 11 48 16 47 30 C42 25 37 21 33 19 C29 23 22 26 17 30 Z'],
  ['M15.5 31 C15 16 23 10 32 10 C41 10 49 16 48.5 31 L49 41 C45 43 19 43 15 41 Z', 'M17 30 C16 16 25 11 32 11 C40 11 48 16 47 30 C44 25 38 22 32 22 C26 22 20 25 17 30 Z'],
  ['', 'M17.5 28 C18 17 25 13 32 13 C39 13 46 17 46.5 28 C42 22.5 22 22.5 17.5 28 Z'],
];

function hash(s: string) {
  let h = 0x811c9dc5;
  for (const ch of s) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** `color` mixed 22% into white (what color-mix does on the web). */
function tint(color: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return '#e4e6eb';
  const n = parseInt(m[1], 16);
  const mix = (v: number) => Math.round(v * 0.22 + 255 * 0.78).toString(16).padStart(2, '0');
  return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

const cache = new Map<string, string>();

export function characterSvg(seed: string, color: string) {
  const h = hash(seed);
  const pick = <T,>(arr: T[], shift: number) => arr[(h >>> shift) % arr.length];
  const skin = pick(SKIN, 0), hair = pick(HAIR, 5), [back, front] = pick(HAIRCUTS, 10);
  const glasses = (h >>> 15) % 5 === 0, happy = (h >>> 18) % 3 === 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${tint(color)}"/>`
    + (back ? `<path d="${back}" fill="${hair}"/>` : '')
    + `<path d="M10 64 C10 52 20 46 32 46 C44 46 54 52 54 64 Z" fill="${color}"/>`
    + `<rect x="27" y="38" width="10" height="10" rx="4" fill="${skin}"/><circle cx="17" cy="32" r="3.4" fill="${skin}"/><circle cx="47" cy="32" r="3.4" fill="${skin}"/>`
    + `<ellipse cx="32" cy="30" rx="15" ry="16" fill="${skin}"/><path d="${front}" fill="${hair}"/>`
    + (happy ? `<path d="M23.5 32 q3 -3 6 0 M34.5 32 q3 -3 6 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`
      : `<circle cx="26.5" cy="31.5" r="2.3" fill="${INK}"/><circle cx="37.5" cy="31.5" r="2.3" fill="${INK}"/>`)
    + (glasses ? `<g stroke="${INK}" stroke-width="1.6" fill="none"><circle cx="26.5" cy="31.5" r="4.6"/><circle cx="37.5" cy="31.5" r="4.6"/><path d="M31.1 31.5 h1.8"/></g>` : '')
    + `<circle cx="22.5" cy="37" r="2.6" fill="${BLUSH}" opacity=".28"/><circle cx="41.5" cy="37" r="2.6" fill="${BLUSH}" opacity=".28"/>`
    + `<path d="M28.5 38.5 q3.5 3.5 7 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
}

/** The character as a data: URI, cached per seed and colour. */
export function characterUri(seed: string, color: string) {
  const k = `${seed}|${color}`;
  let uri = cache.get(k);
  if (!uri) {
    uri = `data:image/svg+xml;base64,${btoa(characterSvg(seed, color))}`;
    cache.set(k, uri);
  }
  return uri;
}
