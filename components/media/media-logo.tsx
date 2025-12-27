"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useMemo } from "react";

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
  /**
   * Container size variant - affects max dimensions
   * - 'small': Compact spaces (cards, lists)
   * - 'medium': Default hero/carousel sizes
   * - 'large': Full-width hero sections
   * - 'xlarge': Extra large hero/section
   * - '2xxl': Largest extra-visual header
   */
  size?: "small" | "medium" | "large" | "xlarge" | "2xxl";
  /**
   * Maximum height override (CSS value, e.g., "300px")
   */
  maxHeight?: string;
  /**
   * Maximum width override (CSS value, e.g., "500px")
   */
  maxWidth?: string;
  /**
   * Alignment of the logo within its container
   * @default "left"
   */
  align?: "left" | "center" | "right";
}

/**
 * Displays a media title logo inside a responsive container.
 * Automatically adjusts based on logo aspect ratio and container size.
 * Falls back to text when a logo asset is unavailable.
 * v3.3 supports various aspect ratios and extra large sizes.
 */
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
        // @ts-ignore
        const variant = sizeVariants[size];
        // @ts-ignore
        return cn(base, variant[aspectType], className);
      }
      // Fallback to medium
      // @ts-ignore
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
    const style: React.CSSProperties = {};
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
