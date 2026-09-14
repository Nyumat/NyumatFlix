"use client";

type BackdropTopRankRibbonProps = {
  rank: number;
};

/** Top-left rank ribbon for wide-catalog top-rated tiles (clip-path badge). */
export function BackdropTopRankRibbon({ rank }: BackdropTopRankRibbonProps) {
  const rankLabel = String(rank).padStart(2, "0");

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-20 flex flex-col items-center justify-center overflow-hidden bg-pink-500 font-bold text-white shadow-[0_4px_10px_rgba(236,72,153,0.45)]"
      style={{
        width: 30,
        height: 38,
        padding: "5px 2px 7px",
        clipPath: "polygon(0px 0px, 100% 0px, 100% 100%, 50% 85%, 0px 100%)",
      }}
    >
      <span className="text-[9px] leading-tight uppercase tracking-wide">
        Top
      </span>
      <span className="-mt-0.5 text-[11px] leading-none tabular-nums">
        {rankLabel}
      </span>
    </div>
  );
}
