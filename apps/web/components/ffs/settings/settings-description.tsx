"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SettingsDescriptionProps = {
  children: ReactNode;
  className?: string;
};

export function SettingsDescription({
  children,
  className,
}: SettingsDescriptionProps) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>{children}</p>
  );
}
