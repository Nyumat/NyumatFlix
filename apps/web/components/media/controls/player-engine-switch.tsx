"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePlayerEngine } from "@/hooks/use-movi-preview";
import { prefetchMoviScrapePlayer } from "@/lib/scrape/prefetch-scrape-player";
import { cn } from "@/lib/utils";

type PlayerEngineSwitchProps = {
  className?: string;
};

export function PlayerEngineSwitch({ className }: PlayerEngineSwitchProps) {
  const { isMovi, setPlayerEngine } = usePlayerEngine();

  const handleCheckedChange = (checked: boolean) => {
    const next = checked ? "vidstack" : "movi";
    if (next === "movi") {
      prefetchMoviScrapePlayer();
    }
    setPlayerEngine(next);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium text-foreground">Player</Label>
      <div className="flex items-center gap-2 text-sm text-foreground">
        <span className={cn(!isMovi && "opacity-50")}>Movi</span>
        <Switch
          checked={!isMovi}
          onCheckedChange={handleCheckedChange}
          aria-label="Switch player engine"
        />
        <span className={cn(isMovi && "opacity-50")}>Vidstack</span>
      </div>
    </div>
  );
}
