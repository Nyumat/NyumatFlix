"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
};

export function SettingsSection({
  title,
  description,
  children,
  className,
  actions,
}: SettingsSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          {description ? (
            <p className="max-w-prose text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
