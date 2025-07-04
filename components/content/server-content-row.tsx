import { MediaItem } from "@/utils/typings";
import { ContentRow, ContentRowVariant } from "./content-row";

/**
 * Props for the ServerContentRow component
 */
interface ServerContentRowProps {
  /** Title to display for the content row */
  title: string;
  /** Array of media items to display */
  items: MediaItem[];
  /** Link href for the "View All" button */
  href: string;
  /** Optional variant for the content row */
  variant?: ContentRowVariant;
  /** Optional content rating mapping */
  contentRating?: Record<number, string | null>;
}

/**
 * ServerContentRow is a server component that renders content rows with data
 * passed directly as props, eliminating the need for client-side data fetching
 * @param props - The props for the ServerContentRow component.
 * @returns The ServerContentRow component.
 */
export function ServerContentRow({
  title,
  items,
  href,
  variant = "standard",
  contentRating = {},
}: ServerContentRowProps) {
  // Filter out items without poster paths
  const validItems = items.filter((item) => item.poster_path);

  // Don't render if no valid items
  if (validItems.length === 0) {
    return null;
  }

  return (
    <section className="my-4">
      <ContentRow
        title={title}
        items={validItems}
        href={href}
        variant={variant}
        contentRating={contentRating}
      />
    </section>
  );
}
