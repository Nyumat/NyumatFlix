import { MediaItem } from "@/utils/typings";
import { useEffect, useState } from "react";

export function useContentRatings(items: MediaItem[]) {
  const [ratings, setRatings] = useState<Record<number, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!items || items.length === 0) {
      setLoading(false);
      return;
    }

    const fetchRatings = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/content-ratings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ items }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ratings: ${response.statusText}`);
        }

        const data = await response.json();
        setRatings(data.ratings || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        console.error("Error fetching content ratings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRatings();
  }, [items]);

  return { ratings, loading, error };
}

// Helper function to get rating with fallback
export function getRating(
  item: MediaItem,
  ratings: Record<number, string | null>,
  fallback?: string,
): string {
  const rating = ratings[item.id];
  if (rating) {
    return rating;
  }

  if (fallback) {
    return fallback;
  }

  // Default fallbacks based on media type
  if ("title" in item) {
    return "PG";
  } else if ("name" in item) {
    return "TV-14";
  }

  return "NR";
}
