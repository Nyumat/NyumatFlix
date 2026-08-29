import { siteConfig } from "@/config/site";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/constants";
import type { Metadata } from "next";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
  buildCanonicalUrl,
} from "./constants";

type BuildPageMetadataOptions = {
  title: string;
  description?: string;
  path?: string;
  ogType?: "website" | "article" | "profile";
  noIndex?: boolean;
  image?: string;
  imageAlt?: string;
  includeDefaultImage?: boolean;
};

export const truncateDescription = (text: string, maxLength = 160) => {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
};

export const formatTitle = (title: string, suffix = SITE_NAME) =>
  title.endsWith(`| ${suffix}`) ? title : `${title} | ${suffix}`;

export const buildPageMetadata = ({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  ogType = "website",
  noIndex = false,
  image = DEFAULT_OG_IMAGE,
  imageAlt = SITE_NAME,
  includeDefaultImage = true,
}: BuildPageMetadataOptions): Metadata => {
  const formattedTitle = formatTitle(title);
  const canonical = path ? buildCanonicalUrl(path) : undefined;
  const imageMetadata = includeDefaultImage
    ? {
        images: [
          {
            url: image,
            width: OG_IMAGE_SIZE.width,
            height: OG_IMAGE_SIZE.height,
            type: DEFAULT_OG_IMAGE_TYPE,
            alt: imageAlt,
          },
        ],
      }
    : {};

  return {
    title: formattedTitle,
    description,
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
    ...(canonical && {
      alternates: {
        canonical,
      },
    }),
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      title: formattedTitle,
      description,
      ...(canonical && { url: canonical }),
      ...imageMetadata,
    },
    twitter: {
      card: "summary_large_image",
      title: formattedTitle,
      description,
      ...(includeDefaultImage && { images: [image] }),
    },
  };
};

export const buildCatalogMetadata = ({
  title,
  description,
  path,
}: {
  title: string;
  description?: string;
  path: string;
}): Metadata =>
  buildPageMetadata({
    title,
    description: description ?? siteConfig.description,
    path,
  });

export const buildNotFoundMetadata = (title: string): Metadata => ({
  title: formatTitle(title),
  robots: {
    index: false,
    follow: false,
  },
});
