import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { IndexPage } from "@/components/catalog/index-page";
import { PageContainer } from "@/components/layout/page-container";
import { LiveTvPage } from "@/components/live/live-tv-page";
import { getSiteFlags } from "@/lib/flags/site-flags-server";
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

export const prefetch = "partial";
export const instant = false;

export async function generateMetadata({
  searchParams,
}: LivePageProps): Promise<Metadata> {
  const flags = await getSiteFlags();
  if (!flags.liveTvEnabled) {
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

export default async function LivePage(props: LivePageProps) {
  await connection();
  const searchParams = await props.searchParams;
  const flags = await getSiteFlags();
  if (!flags.liveTvEnabled) {
    notFound();
  }

  const [{ ch }, initialGuide] = await Promise.all([
    searchParams,
    loadInitialLiveGuide(),
  ]);

  return (
    <PageContainer>
      <IndexPage>
        <LiveTvPage
          initialGuide={initialGuide}
          initialChannelSlug={ch ?? null}
        />
      </IndexPage>
    </PageContainer>
  );
}
