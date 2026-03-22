"use client";

import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { PosterSize } from "@/tmdb/utils";
import { tmdbImage } from "@/tmdb/utils";
import Image from "next/image";
import { type ComponentProps, type CSSProperties, useMemo } from "react";

const Root: React.FC<ComponentProps<"div">> = ({ className, ...props }) => {
  return (
    <div
      className={cn("group relative w-full overflow-hidden", className)}
      {...props}
    />
  );
};

const Content: React.FC<ComponentProps<"div">> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn("overlay", className)} {...props}>
      <div className="p-2 md:p-6">{children}</div>
    </div>
  );
};

const Title: React.FC<ComponentProps<"h2">> = ({ className, ...props }) => {
  return (
    <h2
      className={cn("line-clamp-1 text-sm font-medium md:text-lg", className)}
      {...props}
    />
  );
};

const Excerpt: React.FC<ComponentProps<"p">> = ({ className, ...props }) => {
  return (
    <p
      className={cn(
        "line-clamp-3 text-xs text-muted-foreground md:text-base",
        className,
      )}
      {...props}
    />
  );
};

export const MediaCard = {
  Root,
  Content,
  Title,
  Excerpt,
};

export {
  Root as MediaCardRoot,
  Content as MediaCardContent,
  Title as MediaCardTitle,
  Excerpt as MediaCardExcerpt,
};

interface MediaPosterProps extends ComponentProps<"div"> {
  image?: string;
  size?: PosterSize;
  alt: string;
  priority?: boolean;
  monochrome?: boolean;
}

type LegacyPosterSize = "small" | "medium" | "large";

const legacyPosterMap: Record<LegacyPosterSize, PosterSize> = {
  small: "w185",
  medium: "w342",
  large: "w500",
};

type PosterCompatProps = {
  posterPath?: string | null;
  title?: string;
  size?: LegacyPosterSize | PosterSize;
  className?: string;
};

export function Poster({
  posterPath,
  title = "",
  size = "w342",
  className,
}: PosterCompatProps) {
  const resolved: PosterSize =
    size === "small" || size === "medium" || size === "large"
      ? legacyPosterMap[size]
      : size;

  return (
    <MediaPoster
      image={posterPath ?? undefined}
      alt={title}
      size={resolved}
      className={className}
    />
  );
}

export const MediaPoster: React.FC<MediaPosterProps> = ({
  image,
  size = "w500",
  alt,
  className,
  priority,
  monochrome,
  ...props
}) => {
  const src = image ? tmdbImage.poster(image, size) : null;

  if (!src) {
    return (
      <div
        className={cn(
          "relative aspect-poster w-full rounded-md border bg-muted text-muted-foreground",
          className,
        )}
        {...props}
      >
        <div className="grid size-full min-h-0 place-items-center">
          <Icons.Logo className="size-12" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-poster w-full overflow-hidden rounded-md border bg-muted",
        className,
      )}
      {...props}
    >
      <Image
        src={src}
        alt={alt}
        priority={priority}
        unoptimized
        fill
        sizes="(max-width: 768px) 40vw, (max-width: 1200px) 20vw, 200px"
        className={cn("object-cover", monochrome && "grayscale")}
      />
    </div>
  );
};

interface MediaLogoProps {
  logo?: {
    file_path: string;
    width?: number;
    height?: number;
    aspect_ratio?: number;
  };
  title?: string;
  className?: string;
  fallbackClassName?: string;
  size?: "small" | "medium" | "large" | "xlarge" | "2xxl";
  maxHeight?: string;
  maxWidth?: string;
  align?: "left" | "center" | "right";
}

export function MediaLogo({
  logo,
  title,
  className,
  fallbackClassName,
  size = "medium",
  maxHeight,
  maxWidth,
  align = "left",
}: MediaLogoProps) {
  const aspectRatio = useMemo(() => {
    if (!logo) return null;
    if (logo.aspect_ratio) return logo.aspect_ratio;
    if (logo.width && logo.height) return logo.width / logo.height;
    return null;
  }, [logo]);

  const aspectType = useMemo(() => {
    if (aspectRatio === null) return "standard";
    if (aspectRatio > 3.2) return "ultraWide";
    if (aspectRatio > 2) return "wide";
    if (aspectRatio >= 1.2 && aspectRatio <= 2) return "standard";
    if (aspectRatio >= 0.8 && aspectRatio < 1.2) return "squareish";
    if (aspectRatio < 0.8) return "tall";
    return "standard";
  }, [aspectRatio]);

  const containerClasses = useMemo(() => {
    const base = cn(
      "flex items-center rounded-md bg-transparent",
      align === "left" && "justify-start",
      align === "center" && "justify-center",
      align === "right" && "justify-end",
    );
    const sizeVariants = {
      small: {
        ultraWide: "h-4 max-w-28 sm:h-5 sm:max-w-36 md:h-6 md:max-w-48",
        wide: "h-6 max-w-20 sm:h-7 sm:max-w-24 md:h-8 md:max-w-28",
        standard: "h-8 max-w-24 sm:h-9 sm:max-w-28 md:h-10 md:max-w-32",
        squareish: "h-9 max-w-9 sm:h-10 sm:max-w-10 md:h-12 md:max-w-12",
        tall: "h-10 max-w-12 sm:h-12 sm:max-w-14 md:h-14 md:max-w-16",
      },
      medium: {
        ultraWide: "h-8 max-w-56 sm:h-9 sm:max-w-64 md:h-10 md:max-w-80",
        wide: "h-12 max-w-48 sm:h-14 sm:max-w-56 md:h-16 md:max-w-64",
        standard: "h-10 max-w-32 sm:h-12 sm:max-w-40 md:h-14 md:max-w-48",
        squareish: "h-16 max-w-16 sm:h-20 sm:max-w-20 md:h-24 md:max-w-24",
        tall: "h-20 max-w-24 sm:h-24 sm:max-w-28 md:h-28 md:max-w-32",
      },
      large: {
        ultraWide:
          "h-10 max-w-80 sm:h-14 sm:max-w-[28rem] md:h-16 md:max-w-[32rem] lg:h-20 lg:max-w-[38rem]",
        wide: "h-16 max-w-64 sm:h-20 sm:max-w-80 md:h-24 md:max-w-96 lg:h-28 lg:max-w-[28rem]",
        standard:
          "h-20 max-w-48 sm:h-24 sm:max-w-56 md:h-28 md:max-w-64 lg:h-32 lg:max-w-72",
        squareish: "h-28 max-w-28 sm:h-32 sm:max-w-32 md:h-36 md:max-w-36",
        tall: "h-32 max-w-40 sm:h-40 sm:max-w-48 md:h-48 md:max-w-56 lg:h-56 lg:max-w-64",
      },
      xlarge: {
        ultraWide:
          "h-14 max-w-[32rem] sm:h-16 sm:max-w-[40rem] md:h-20 md:max-w-[50rem] lg:h-24 lg:max-w-[60rem]",
        wide: "h-24 max-w-[22rem] sm:h-28 sm:max-w-[28rem] md:h-32 md:max-w-[32rem] lg:h-36 lg:max-w-[38rem]",
        standard:
          "h-32 max-w-72 sm:h-36 sm:max-w-80 md:h-40 md:max-w-96 lg:h-48 lg:max-w-[30rem]",
        squareish: "h-36 max-w-36 sm:h-40 sm:max-w-40 md:h-48 md:max-w-48",
        tall: "h-48 max-w-56 sm:h-56 sm:max-w-64 md:h-64 md:max-w-72 lg:h-72 lg:max-w-80",
      },
      "2xxl": {
        ultraWide:
          "h-16 max-w-[40rem] sm:h-20 sm:max-w-[48rem] md:h-24 md:max-w-[60rem] lg:h-32 lg:max-w-[80rem]",
        wide: "h-28 max-w-[32rem] sm:h-32 sm:max-w-[38rem] md:h-36 md:max-w-[44rem] lg:h-40 lg:max-w-[50rem]",
        standard:
          "h-40 max-w-96 sm:h-48 sm:max-w-[30rem] md:h-56 md:max-w-[38rem] lg:h-64 lg:max-w-[46rem]",
        squareish: "h-48 max-w-48 sm:h-56 sm:max-w-56 md:h-64 md:max-w-64",
        tall: "h-64 max-w-80 sm:h-72 sm:max-w-96 md:h-80 md:max-w-[30rem] lg:h-[30rem] lg:max-w-[36rem]",
      },
    };

    const getClass = () => {
      if (size in sizeVariants) {
        // @ts-ignore dynamic key
        const variant = sizeVariants[size];
        // @ts-ignore dynamic key
        return cn(base, variant[aspectType], className);
      }
      // @ts-ignore dynamic key
      return cn(base, sizeVariants["medium"][aspectType], className);
    };

    return getClass();
  }, [size, aspectType, className, align]);

  const imageSizes = useMemo(() => {
    switch (size) {
      case "small":
        return "(max-width: 640px) 80px, (max-width: 768px) 112px, 128px";
      case "medium":
        return "(max-width: 640px) 192px, (max-width: 768px) 224px, 256px";
      case "large":
        return "(max-width: 640px) 256px, (max-width: 768px) 320px, (max-width: 1024px) 384px, 448px";
      case "xlarge":
        return "(max-width: 640px) 368px, (max-width: 768px) 512px, (max-width: 1024px) 672px, 800px";
      case "2xxl":
        return "(max-width: 640px) 480px, (max-width: 768px) 640px, (max-width: 1024px) 800px, 1100px";
      default:
        return "(max-width: 640px) 192px, (max-width: 768px) 224px, 256px";
    }
  }, [size]);

  if (logo?.file_path) {
    const style: CSSProperties = {};
    if (maxHeight) style.maxHeight = maxHeight;
    if (maxWidth) style.maxWidth = maxWidth;

    return (
      <div className={containerClasses} style={style}>
        <div className="relative h-full w-full">
          <Image
            src={`https://image.tmdb.org/t/p/w500${logo.file_path}`}
            alt={title || "Logo"}
            fill
            className={cn(
              "object-contain",
              align === "left" && "object-left",
              align === "center" && "object-center",
              align === "right" && "object-right",
            )}
            sizes={imageSizes}
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
