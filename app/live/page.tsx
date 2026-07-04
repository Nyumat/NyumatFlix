import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLiveTvEnabled } from "@/config/features";
import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { LiveTvPage } from "@/components/live/live-tv-page";
import { getLiveChannels } from "@/lib/live/dulo";
import { EMPTY_LIVE_GUIDE } from "@/lib/live/empty-guide";
import {
  buildDefaultLiveMetadata,
  buildLiveChannelMetadataFromSlug,
} from "@/lib/live/live-metadata";
import type { LiveChannelsResponse } from "@/lib/live/types";

type LivePageProps = {
  searchParams: Promise<{ ch?: string }>;
};

export async function generateMetadata({
  searchParams,
}: LivePageProps): Promise<Metadata> {
  if (!isLiveTvEnabled()) {
    return { title: "Not Found | NyumatFlix" };
  }

  const { ch } = await searchParams;

  if (!ch?.trim()) {
    return buildDefaultLiveMetadata();
  }

  return buildLiveChannelMetadataFromSlug(ch);
}

const loadInitialLiveGuide = async (): Promise<LiveChannelsResponse> => {
  try {
    return await getLiveChannels("bootstrap");
  } catch {
    try {
      return await getLiveChannels("full");
    } catch {
      return EMPTY_LIVE_GUIDE;
    }
  }
};

export default async function LivePage({ searchParams }: LivePageProps) {
  if (!isLiveTvEnabled()) {
    notFound();
  }

  const [{ ch }, initialGuide] = await Promise.all([
    searchParams,
    loadInitialLiveGuide(),
  ]);

  return (
    <PageContainer>
      <div className="flex w-full flex-col">
        <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

        <ContentContainer
          topSpacing={false}
          className="relative z-10 flex w-full flex-col items-center"
        >
          <section className="min-h-screen w-full pb-16 pt-[4.75rem] md:pt-20">
            <LiveTvPage
              initialGuide={initialGuide}
              initialChannelSlug={ch ?? null}
            />
          </section>
        </ContentContainer>
      </div>
    </PageContainer>
  );
}
