import type { Metadata } from "next";

import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { LiveTvPage } from "@/components/live/live-tv-page";
import {
  buildDefaultLiveMetadata,
  buildLiveChannelMetadataFromSlug,
} from "@/lib/live/live-metadata";

export const dynamic = "force-dynamic";

type LivePageProps = {
  searchParams: Promise<{ ch?: string }>;
};

export async function generateMetadata({
  searchParams,
}: LivePageProps): Promise<Metadata> {
  const { ch } = await searchParams;

  if (!ch?.trim()) {
    return buildDefaultLiveMetadata();
  }

  return buildLiveChannelMetadataFromSlug(ch);
}

export default async function LivePage({ searchParams }: LivePageProps) {
  const { ch } = await searchParams;

  return (
    <PageContainer>
      <div className="flex w-full flex-col">
        <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

        <ContentContainer
          topSpacing={false}
          className="relative z-10 flex w-full flex-col items-center"
        >
          <section className="min-h-screen w-full pb-16 pt-[4.75rem] md:pt-20">
            <LiveTvPage initialChannelSlug={ch ?? null} />
          </section>
        </ContentContainer>
      </div>
    </PageContainer>
  );
}
