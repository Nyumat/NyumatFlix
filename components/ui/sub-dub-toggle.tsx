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
        "backdrop-blur-md bg-white/10 border border-white/30 rounded-full hover:bg-white/20 hover:border-white/40 hover:shadow-xl transition shadow-lg overflow-hidden",
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
          className="px-2 py-0.5 text-[10px] font-medium rounded-full data-[state=on]:bg-white/20 data-[state=on]:text-black data-[state=off]:text-white data-[state=off]:hover:text-white/80 transition-colors duration-200"
          aria-label="Subtitles"
        >
          SUB
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dub"
          className="px-2 py-0.5 text-[10px] font-medium rounded-full data-[state=on]:bg-white/20 data-[state=on]:text-black data-[state=off]:text-white data-[state=off]:hover:text-white/80 transition-colors duration-200"
          aria-label="Dubbed audio"
        >
          DUB
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  ),
);

SubDubToggle.displayName = "SubDubToggle";
