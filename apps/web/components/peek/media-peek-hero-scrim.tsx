import { cn } from "@/lib/utils";

type MediaPeekHeroScrimProps = {
  className?: string;
};

export const MediaPeekHeroScrim = ({ className }: MediaPeekHeroScrimProps) => (
  <div
    className={cn("pointer-events-none absolute inset-0 z-[1]", className)}
    aria-hidden
  >
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,hsl(var(--background))_0%,hsl(var(--background)/0.96)_14%,hsl(var(--background)/0.72)_32%,hsl(var(--background)/0.34)_54%,hsl(var(--background)/0.08)_76%,transparent_100%)]" />
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--background)/0.94)_0%,hsl(var(--background)/0.52)_24%,hsl(var(--background)/0.14)_46%,transparent_64%)]" />
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[32%] bg-[linear-gradient(to_bottom,hsl(var(--background)/0.38)_0%,hsl(var(--background)/0.1)_42%,transparent_100%)]" />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
  </div>
);
