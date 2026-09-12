import { WatchlistPageLoading } from "@/components/layout/page-loading/watchlist-page-loading";
import { WatchlistLoadingShell } from "@/components/layout/page-loading/page-loading-shell";

export default function WatchlistLoading() {
  return (
    <WatchlistLoadingShell>
      <WatchlistPageLoading />
    </WatchlistLoadingShell>
  );
}
