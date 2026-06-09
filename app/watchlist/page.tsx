import { auth } from "@/auth";
import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import { WatchlistGridFallback } from "@/components/watchlist/watchlist-grid-fallback";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUserWatchlist } from "./actions";
import { WatchlistClient } from "./watchlist-client";
import { WatchlistContent } from "./watchlist-content";

export const metadata: Metadata = {
  title: "My Watchlist | NyumatFlix",
  description: "Manage your watchlist and track your viewing progress",
};

export default async function WatchlistPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const watchlistItems = await getUserWatchlist(session.user.id);

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />
      <ContentContainer className="z-10 flex w-full flex-1 flex-col items-center">
        {watchlistItems.length === 0 ? (
          <WatchlistClient allItems={[]} watchlistItems={[]} />
        ) : (
          <Suspense fallback={<WatchlistGridFallback />}>
            <WatchlistContent watchlistItems={watchlistItems} />
          </Suspense>
        )}
      </ContentContainer>
    </div>
  );
}
