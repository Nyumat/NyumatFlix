import type { Metadata } from "next";

import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { LiveTvPage } from "@/components/live/live-tv-page";
import { getLiveChannels } from "@/lib/live/dulo";

export const dynamic = "force-dynamic";

const LIVE_DESCRIPTION = "Watch live TV channels and events on NyumatFlix.";

export const metadata: Metadata = {
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
        url: "https://nyumatflix.com/og.webp",
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
    images: ["https://nyumatflix.com/og.webp"],
  },
};

export default async function LivePage() {
  const guide = await getLiveChannels();

  return (
    <PageContainer>
      <div className="flex w-full flex-col">
        <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

        <ContentContainer className="relative z-10 flex w-full flex-col items-center">
          <section className="min-h-screen w-full pb-16 pt-14 md:pt-16">
            <LiveTvPage initialGuide={guide} />
          </section>
        </ContentContainer>
      </div>
    </PageContainer>
  );
}
