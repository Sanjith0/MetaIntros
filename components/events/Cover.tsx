/** Generated cover art: gradients and shapes from a hue. No images.
 *  Three layouts, picked from the hue, so neighbouring cards differ. */
export function Cover({ hue, title, className = "", rounded = "" }: { hue: number; title: string; className?: string; rounded?: string }) {
  const a = `hsl(${hue} 70% 58%)`;
  const b = `hsl(${(hue + 40) % 360} 65% 42%)`;
  const c = `hsl(${(hue + 320) % 360} 80% 72%)`;
  const d = `hsl(${(hue + 180) % 360} 70% 70%)`;
  const variant = (hue * 7 + title.length) % 3;
  return (
    <div
      role="img"
      aria-label={`Cover art for ${title}`}
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ background: `linear-gradient(${variant === 1 ? 200 : 135}deg, ${a}, ${b})` }}
    >
      {variant === 0 && (
        <>
          <div className="absolute -right-[10%] -top-[30%] h-[90%] w-[55%] rounded-full opacity-60" style={{ background: c }} />
          <div className="absolute -bottom-[35%] left-[8%] h-[80%] w-[40%] rounded-full opacity-35" style={{ background: d }} />
          <div className="absolute bottom-[12%] right-[18%] h-[22%] w-[22%] rotate-12 rounded-[18%] border-[6px] border-white/40" />
        </>
      )}
      {variant === 1 && (
        <>
          <div className="absolute inset-y-0 left-[12%] w-[18%] -skew-x-12 opacity-40" style={{ background: c }} />
          <div className="absolute inset-y-0 left-[36%] w-[8%] -skew-x-12 opacity-30" style={{ background: d }} />
          <div className="absolute -right-[6%] top-[18%] h-[64%] w-[34%] rounded-full border-[10px] border-white/35" />
        </>
      )}
      {variant === 2 && (
        <>
          <div className="absolute -left-[8%] top-[10%] h-[120%] w-[50%] rotate-45 rounded-[24%] opacity-35" style={{ background: d }} />
          <div className="absolute right-[10%] top-[14%] h-[30%] w-[16%] rounded-full opacity-70" style={{ background: c }} />
          <div className="absolute bottom-0 left-0 h-[28%] w-full opacity-25" style={{ background: `repeating-linear-gradient(90deg, white 0 2px, transparent 2px 18px)` }} />
        </>
      )}
    </div>
  );
}
