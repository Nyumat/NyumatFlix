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
        "animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both",
        className,
      )}
    >
      {children}
    </div>
  );
}
