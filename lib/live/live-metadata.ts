import type { Metadata } from "next";

import {
  buildLiveChannelShareUrl,
  buildLiveShareUrlFromSlug,
  formatChannelSlugForDisplay,
} from "@/lib/live/channel-slugs";
import type { LiveChannel } from "@/lib/live/types";

const LIVE_DESCRIPTION = "Watch live TV channels and events on NyumatFlix.";
const DEFAULT_OG_IMAGE = "https://nyumatflix.com/og.webp";

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
    canonical: "https://nyumatflix.com/live",
  },
  openGraph: {
    type: "website",
    url: "https://nyumatflix.com/live",
    title: "Live TV | NyumatFlix",
    description: LIVE_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        type: "image/webp",
        alt: "NyumatFlix Live TV",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com",
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
          width: 1200,
          height: 630,
          type: "image/webp",
          alt: `${channelName} on NyumatFlix`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "https://nyumatflix.com",
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
          width: 1200,
          height: 630,
          type: channel.logoUrl ? "image/png" : "image/webp",
          alt: `${channel.name} on NyumatFlix`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "https://nyumatflix.com",
      title,
      description,
      images: [imageUrl],
    },
  };
};
