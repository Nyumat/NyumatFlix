"use client";

import { getWatchlistItem } from "@/app/watchlist/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

interface WatchlistButtonProps {
  contentId: number;
  mediaType?: "movie" | "tv";
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
  const session = useSession();

  useEffect(() => {
    if (!mediaType) return;
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
    // TODO(Nyumat): Fix over-fetching with TanStack Query and or caching
    checkWatchlistStatus();
  }, [contentId, mediaType]);

  const handleToggle = async () => {
    if (isLoading) return;
    // TODO(Nyumat): local-only / single device watchlists
    if (!session.data?.user?.id)
      return toast.error(
        "To add items to your watchlist, you must be logged in.",
      );

    try {
      if (isInWatchlist) {
        if (!mediaType) return;
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
        if (!mediaType) return;
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
      <Button variant={variant} size={size} className={cn(className)} disabled>
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
      {children && <span className="ml-2 text-sm font-medium">{children}</span>}
    </Button>
  );
}
