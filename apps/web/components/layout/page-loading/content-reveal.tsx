import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ContentRevealProps {
  children: ReactNode;
  className?: string;
}

export function ContentReveal({ children, className }: ContentRevealProps) {
  return (
    <div
      className={cn(
        "max-lg:animate-none",
        "lg:animate-in lg:fade-in lg:slide-in-from-bottom-1 lg:duration-500 lg:fill-mode-both",
        className,
      )}
    >
      {children}
    </div>
  );
}
