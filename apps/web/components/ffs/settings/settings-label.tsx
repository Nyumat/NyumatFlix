"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SettingsLabelProps = {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
};

export function SettingsLabel({
  children,
  htmlFor,
  className,
}: SettingsLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-sm font-medium text-foreground", className)}
    >
      {children}
    </label>
  );
}
