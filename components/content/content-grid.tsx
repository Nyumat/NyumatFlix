import { MediaCard } from "@/components/media/media-card";
import type { MediaItem } from "@/utils/typings";

/**
 * Props for the ContentGrid component
 */
interface ContentGridProps {
  /** Optional title to display above the grid */
  title?: string;
  /** Array of media items to display in the grid */
  items: MediaItem[];
  /** Media type for all items in the grid */
  type: "movie" | "tv";
}

/**
 * ContentGrid component displays media items in a responsive grid layout
 * Used for showcasing collections of movies or TV shows with consistent spacing
 * @param props - The component props
 * @returns A responsive grid of media cards with optional title
 */
export function ContentGrid({ title, items, type }: ContentGridProps) {
  if (!items.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No items to display</p>
      </div>
    );
  }

  // Map our items to the format expected by MediaCard
  const processedItems = items.map((item) => ({
    ...item,
    media_type: type, // Ensure media_type is correctly passed
  }));

  return (
    <div className="space-y-6">
      {title && <h2 className="text-2xl font-bold text-foreground">{title}</h2>}

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        {processedItems.map((item: MediaItem, i: number) => {
          return (
            <div key={`${item.id}-${i}`} className="w-full">
              <MediaCard
                item={item}
                type={type}
                rating={item.content_rating || undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
