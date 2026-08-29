"use client";

import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

type SearchListRowProps = ComponentPropsWithoutRef<"button"> & {
  isSelected?: boolean;
};

export function SearchListRow({
  isSelected = false,
  className,
  children,
  type = "button",
  ...props
}: SearchListRowProps) {
  return (
    <button
      type={type}
      className={cn(
        "group relative flex w-full items-center gap-3 px-2.5 py-2 text-left outline-none transition-colors duration-150",
        isSelected
          ? "bg-white/[0.06]"
          : "hover:bg-white/[0.04] active:bg-white/[0.07]",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-r-full transition-colors duration-150",
          isSelected
            ? "bg-primary"
            : "bg-transparent group-hover:bg-white/15 group-active:bg-white/25",
        )}
      />
      {children}
    </button>
  );
}
