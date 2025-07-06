"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function LoadingSpinner({
  size = "md",
  className,
  text,
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <div
          className={cn(
            "border-2 border-primary border-t-transparent rounded-full animate-spin",
            sizeClasses[size],
          )}
        />
        {text && <span className="text-sm">{text}</span>}
      </div>
    </div>
  );
}

export function LoadingSpinnerFullHeight({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
