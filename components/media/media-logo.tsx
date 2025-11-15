import Image from "next/image";
import { cn } from "@/lib/utils";

interface MediaLogoProps {
  logo?: {
    file_path: string;
    width?: number;
    height?: number;
  };
  title?: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Displays a media title logo inside a consistent container.
 * Falls back to text when a logo asset is unavailable.
 */
export function MediaLogo({
  logo,
  title,
  className,
  fallbackClassName,
}: MediaLogoProps) {
  if (logo?.file_path) {
    return (
      <div
        className={cn(
          "flex h-10 w-32 items-center justify-start sm:h-12 sm:w-40 md:h-14 md:w-48",
          "rounded-md bg-transparent",
          className,
        )}
      >
        <div className="relative h-full w-full">
          <Image
            src={`https://image.tmdb.org/t/p/w342${logo.file_path}`}
            alt={title || "Logo"}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 120px, (max-width: 768px) 160px, 190px"
            priority={false}
          />
        </div>
      </div>
    );
  }

  if (!title) {
    return null;
  }

  return (
    <h3
      className={cn(
        "font-semibold leading-tight text-foreground",
        fallbackClassName,
      )}
    >
      {title}
    </h3>
  );
}
