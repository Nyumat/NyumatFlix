"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const settingsRowVariants = cva(
  "flex gap-4 transition-colors duration-150 motion-reduce:transition-none",
  {
    variants: {
      layout: {
        inline: "flex-col py-3 sm:flex-row sm:items-center sm:justify-between",
        stacked: "flex-col py-3",
      },
      density: {
        default: "py-3",
        compact: "py-2",
      },
    },
    defaultVariants: {
      layout: "inline",
      density: "default",
    },
  },
);

type SettingsRowProps = VariantProps<typeof settingsRowVariants> & {
  label: ReactNode;
  description?: ReactNode;
  control: ReactNode;
  className?: string;
  controlClassName?: string;
};

export function SettingsRow({
  label,
  description,
  control,
  layout,
  density,
  className,
  controlClassName,
}: SettingsRowProps) {
  return (
    <div className={cn(settingsRowVariants({ layout, density }), className)}>
      <div className="min-w-0 flex-1 space-y-0.5">
        {typeof label === "string" ? (
          <p className="text-sm font-medium text-foreground">{label}</p>
        ) : (
          label
        )}
        {description ? (
          typeof description === "string" ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : (
            description
          )
        ) : null}
      </div>
      <div className={cn("shrink-0", controlClassName)}>{control}</div>
    </div>
  );
}
