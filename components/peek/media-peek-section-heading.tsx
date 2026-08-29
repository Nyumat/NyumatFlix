import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type MediaPeekSectionHeadingProps = {
  title: string;
  className?: string;
  action?: ReactNode;
};

export const MediaPeekSectionHeading = ({
  title,
  className,
  action,
}: MediaPeekSectionHeadingProps) => (
  <div
    className={cn(
      "mb-3 flex items-center justify-between gap-3 sm:mb-4",
      className,
    )}
  >
    <h3 className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground sm:text-lg">
      <span
        className="h-5 w-0.5 rounded-full bg-primary/90 sm:h-6"
        aria-hidden
      />
      {title}
    </h3>
    {action}
  </div>
);
