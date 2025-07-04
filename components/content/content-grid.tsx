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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {processedItems.map((item: any, i: number) => {
          const itemType = item.media_type;

          return (
            <div
              key={`${item.id}-${i}`}
              className="rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              <MediaCard item={item} type={itemType} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
