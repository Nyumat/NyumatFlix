"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

type DetailWatchlistStatusToggleProps = {
  watchlistItem: WatchlistItem;
  className?: string;
  onUpdated?: () => void;
};

export function DetailWatchlistStatusToggle({
  watchlistItem,
  className,
  onUpdated,
}: DetailWatchlistStatusToggleProps) {
  const session = useSession();
  const [isSaving, setIsSaving] = useState(false);

  const handleStatusChange = async (value: string) => {
    if (!value || value === watchlistItem.status || !session.data?.user?.id) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/watchlist/${watchlistItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: value,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update watchlist status");
      }

      onUpdated?.();
    } catch (error) {
      console.error(error);
      toast.error("Couldn't update watchlist status");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ToggleGroup
      type="single"
      value={watchlistItem.status}
      onValueChange={(value) => {
        void handleStatusChange(value);
      }}
      disabled={isSaving}
      className={cn(
        "rounded-lg border border-white/25 bg-black/40 p-1 shadow-lg backdrop-blur-md",
        className,
      )}
      data-testid="detail-watchlist-status-toggle"
    >
      {(
        [
          { value: "watching", label: "Watching" },
          { value: "plan_to_watch", label: "Plan to Watch" },
          { value: "on_hold", label: "On-Hold" },
          { value: "dropped", label: "Dropped" },
          { value: "completed", label: "Completed" },
        ] as const
      ).map(({ value, label }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          className="rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white data-[state=on]:bg-white data-[state=on]:text-black"
        >
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
