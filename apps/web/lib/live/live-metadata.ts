import type { Metadata } from "next";

import { SITE_URL } from "@/lib/constants";
import {
  buildLiveChannelShareUrl,
  buildLiveShareUrlFromSlug,
  formatChannelSlugForDisplay,
} from "@/lib/live/channel-slugs";
import type { LiveChannel } from "@/lib/live/types";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/seo/constants";

const LIVE_DESCRIPTION = "Watch live TV channels and events on NyumatFlix.";

const buildLiveChannelDescription = (channel: LiveChannel) =>
  `Watch ${channel.name} live on NyumatFlix. Stream ${channel.categoryName.toLowerCase()} channels for free.`;

export const buildDefaultLiveMetadata = (): Metadata => ({
  title: "Live TV | NyumatFlix",
  description: LIVE_DESCRIPTION,
  keywords: [
    "live tv",
    "live television",
    "live streaming",
    "watch live channels",
    "live sports",
    "live news",
    "free live tv",
    "NyumatFlix",
  ],
  alternates: {
    canonical: `${SITE_URL}/live`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/live`,
    title: "Live TV | NyumatFlix",
    description: LIVE_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        type: DEFAULT_OG_IMAGE_TYPE,
        alt: "NyumatFlix Live TV",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE_URL,
    title: "Live TV | NyumatFlix",
    description: LIVE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
});

export const buildLiveChannelMetadataFromSlug = (slug: string): Metadata => {
  const channelName = formatChannelSlugForDisplay(slug);
  const title = `${channelName} Live | NyumatFlix`;
  const description = `Watch ${channelName} live on NyumatFlix.`;
  const shareUrl = buildLiveShareUrlFromSlug(slug);

  return {
    title,
    description,
    keywords: [channelName, `${channelName} live`, "live tv", "NyumatFlix"],
    alternates: {
      canonical: shareUrl,
    },
    openGraph: {
      type: "website",
      url: shareUrl,
      title,
      description,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: OG_IMAGE_SIZE.width,
          height: OG_IMAGE_SIZE.height,
          type: DEFAULT_OG_IMAGE_TYPE,
          alt: `${channelName} on NyumatFlix`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: SITE_URL,
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
};

export const buildLiveChannelMetadata = (channel: LiveChannel): Metadata => {
  const title = `${channel.name} Live | NyumatFlix`;
  const description = buildLiveChannelDescription(channel);
  const shareUrl = buildLiveChannelShareUrl(channel);
  const imageUrl = channel.logoUrl ?? DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    keywords: [
      channel.name,
      `${channel.name} live`,
      "live tv",
      channel.categoryName.toLowerCase(),
      "NyumatFlix",
    ],
    alternates: {
      canonical: shareUrl,
    },
    openGraph: {
      type: "website",
      url: shareUrl,
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: OG_IMAGE_SIZE.width,
          height: OG_IMAGE_SIZE.height,
          type: channel.logoUrl ? "image/png" : DEFAULT_OG_IMAGE_TYPE,
          alt: `${channel.name} on NyumatFlix`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: SITE_URL,
      title,
      description,
      images: [imageUrl],
    },
  };
};
