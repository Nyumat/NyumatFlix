"use client";

import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface SubDubToggleProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: "sub" | "dub";
  onValueChange: (value: "sub" | "dub") => void;
}

export const SubDubToggle = React.forwardRef<HTMLDivElement, SubDubToggleProps>(
  ({ className, value, onValueChange, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden rounded-full border border-border/80 bg-background/50 shadow-lg backdrop-blur-md transition hover:border-border hover:shadow-xl dark:border-white/30 dark:bg-white/10 dark:hover:border-white/40 dark:hover:bg-white/20",
        className,
      )}
      {...props}
    >
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(newValue) => {
          if (newValue) onValueChange(newValue as "sub" | "dub");
        }}
        className="flex items-center gap-0 bg-transparent"
      >
        <ToggleGroupItem
          value="sub"
          className="rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-200 data-[state=on]:bg-primary/20 data-[state=on]:text-primary data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground dark:data-[state=on]:bg-white/20 dark:data-[state=on]:text-black dark:data-[state=off]:text-white/80 dark:data-[state=off]:hover:text-white"
          aria-label="Subtitles"
        >
          SUB
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dub"
          className="rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-200 data-[state=on]:bg-primary/20 data-[state=on]:text-primary data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground dark:data-[state=on]:bg-white/20 dark:data-[state=on]:text-black dark:data-[state=off]:text-white/80 dark:data-[state=off]:hover:text-white"
          aria-label="Dubbed audio"
        >
          DUB
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  ),
);

SubDubToggle.displayName = "SubDubToggle";
