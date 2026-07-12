"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type FfsToggleRowProps = {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
};

export function FfsToggleRow({
  label,
  description,
  enabled,
  onToggle,
  disabled,
}: FfsToggleRowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(!enabled)}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border border-white/10 bg-card/40 p-3 text-left transition-colors",
        "hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50",
        enabled && "border-primary/40 bg-primary/10",
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-white">{label}</p>
        {description ? (
          <p className="text-xs text-white/55">{description}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-white/20",
          enabled && "border-primary/40 bg-primary/20 text-primary",
        )}
      >
        {enabled ? <Check className="size-3" strokeWidth={2} /> : null}
      </span>
    </button>
  );
}
