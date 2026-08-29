import Image from "next/image";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const BRAND_NAME = "dontlarp";
export const BRAND_WORDMARK_SRC = "/dontlarp.svg";
export const BRAND_WORDMARK_ASPECT = 929.302 / 252.206;

export const BRAND_LOGO_SIZES = {
  sm: 28,
  md: 32,
  lg: 36,
} as const;

export type BrandLogoSize = keyof typeof BRAND_LOGO_SIZES;

export type BrandLogoPlacement =
  | "navbar"
  | "footer"
  | "mobile-menu"
  | "auth"
  | "auth-compact"
  | "onboarding"
  | "static";

type PlacementConfig = {
  size: BrandLogoSize;
  priority?: boolean;
  linked?: boolean;
  imageClassName?: string;
  linkClassName?: string;
  wrapperClassName?: string;
  ariaLabel?: string;
};

const PLACEMENT_CONFIG: Record<BrandLogoPlacement, PlacementConfig> = {
  navbar: {
    size: "md",
    priority: true,
    linked: true,
    linkClassName: "inline-flex shrink-0 items-center",
    ariaLabel: `${BRAND_NAME} home`,
  },
  footer: {
    size: "sm",
    linked: true,
    linkClassName: "flex shrink-0 items-center",
    imageClassName: "transition-transform duration-200 hover:scale-105",
    ariaLabel: `${BRAND_NAME} homepage`,
  },
  "mobile-menu": {
    size: "sm",
    linked: true,
    linkClassName: "inline-flex shrink-0 items-center",
    ariaLabel: `${BRAND_NAME} home`,
  },
  auth: {
    size: "lg",
    linked: true,
    linkClassName: "mb-8 inline-flex items-center text-white",
    ariaLabel: `${BRAND_NAME} home`,
  },
  "auth-compact": {
    size: "md",
    linked: true,
    wrapperClassName: "mb-8 flex justify-center lg:hidden",
    linkClassName: "inline-flex items-center",
    ariaLabel: `${BRAND_NAME} home`,
  },
  onboarding: {
    size: "lg",
    wrapperClassName: "mx-auto flex items-center justify-center px-2",
    imageClassName: "max-w-[min(100%,14rem)]",
  },
  static: {
    size: "md",
  },
};

type BrandLogoProps = {
  placement?: BrandLogoPlacement;
  size?: BrandLogoSize;
  className?: string;
  linkClassName?: string;
  wrapperClassName?: string;
  priority?: boolean;
  href?: string;
  onClick?: ComponentProps<typeof Link>["onClick"];
};

const resolveHeight = (
  placement: BrandLogoPlacement | undefined,
  size: BrandLogoSize | undefined,
): number => {
  if (size) {
    return BRAND_LOGO_SIZES[size];
  }

  if (placement) {
    return BRAND_LOGO_SIZES[PLACEMENT_CONFIG[placement].size];
  }

  return BRAND_LOGO_SIZES.md;
};

const BrandLogo = ({
  placement = "static",
  size,
  className,
  linkClassName,
  wrapperClassName,
  priority,
  href = "/",
  onClick,
}: BrandLogoProps) => {
  const config = PLACEMENT_CONFIG[placement];
  const height = resolveHeight(placement, size);
  const width = Math.round(height * BRAND_WORDMARK_ASPECT);

  const image = (
    <Image
      src={BRAND_WORDMARK_SRC}
      alt={BRAND_NAME}
      width={width}
      height={height}
      className={cn("w-auto shrink-0", config.imageClassName, className)}
      style={{ height }}
      priority={priority ?? config.priority}
    />
  );

  const content = config.linked ? (
    <Link
      href={href}
      onClick={onClick}
      className={cn(config.linkClassName, linkClassName)}
      aria-label={config.ariaLabel}
    >
      {image}
      <span className="sr-only">{BRAND_NAME}</span>
    </Link>
  ) : (
    image
  );

  const wrapperClasses = cn(config.wrapperClassName, wrapperClassName);
  if (!wrapperClasses) {
    return content;
  }

  return <div className={wrapperClasses}>{content}</div>;
};

export { BrandLogo };
