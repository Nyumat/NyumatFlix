import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import type { Metadata } from "next";
import { HistoryClient } from "./history-client";

export const metadata: Metadata = {
  title: "Watch History | NyumatFlix",
  description: "Browse everything you have watched on NyumatFlix",
};

export default function HistoryPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />
      <ContentContainer className="z-10 flex w-full flex-1 flex-col items-center">
        <HistoryClient />
      </ContentContainer>
    </div>
  );
}
