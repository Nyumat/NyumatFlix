"use client";

import { type ReactNode, useState, useEffect } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getWatchlistItem } from "@/app/watchlist/actions";

interface WatchlistButtonProps {
  contentId: number;
  mediaType: "movie" | "tv";
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  children?: ReactNode;
}

export function WatchlistButton({
  contentId,
  mediaType,
  className,
  variant = "outline",
  size = "default",
  children,
}: WatchlistButtonProps) {
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkWatchlistStatus = async () => {
      try {
        const item = await getWatchlistItem(contentId, mediaType);
        setIsInWatchlist(!!item);
      } catch (error) {
        console.error("Error checking watchlist status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkWatchlistStatus();
  }, [contentId, mediaType]);

  const handleToggle = async () => {
    if (isLoading) return;

    try {
      if (isInWatchlist) {
        // Get the watchlist item ID first
        const item = await getWatchlistItem(contentId, mediaType);
        if (!item) {
          setIsInWatchlist(false);
          return;
        }

        // Remove from watchlist
        const response = await fetch(`/api/watchlist/${item.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to remove from watchlist");
        }

        setIsInWatchlist(false);
        toast.success("Removed from watchlist");
      } else {
        // Add to watchlist
        const response = await fetch("/api/watchlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contentId,
            mediaType,
            status: "watching",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to add to watchlist");
        }

        setIsInWatchlist(true);
        toast.success("Added to watchlist");
      }
    } catch (error) {
      console.error("Error toggling watchlist:", error);
      toast.error(
        isInWatchlist
          ? "Failed to remove from watchlist"
          : "Failed to add to watchlist",
      );
    }
  };

  if (isLoading) {
    return (
      <Button
        variant={variant}
        size={size}
        className={cn(className)}
        disabled
      >
        <Bookmark className="h-4 w-4" />
        {children && <span className="ml-2 text-sm">Loading...</span>}
      </Button>
    );
  }

  const Icon = isInWatchlist ? BookmarkCheck : Bookmark;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      className={cn(className)}
      aria-label={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Icon className="h-4 w-4" />
      {children && (
        <span className="ml-2 text-sm font-medium">
          {children}
        </span>
      )}
    </Button>
  );
}

