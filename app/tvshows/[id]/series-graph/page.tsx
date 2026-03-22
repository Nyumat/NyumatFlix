import { fetchTMDBData } from "@/app/actions";
import { fetchAllSeasonDetails } from "@/components/tvshow/tvshow-api";
import { TvShowSeasonsPage } from "@/components/tvshow/tvshow-seasons-page";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import { generateMediaMetadata } from "@/utils/media-metadata-helpers";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamicParams = true;

type Props = {
  params: Promise<{ id: string }>;
};

const isTalkShow = (item: MediaItem): boolean => {
  if (Array.isArray(item.genre_ids) && item.genre_ids.includes(10767))
    return true;
  return false;
};

export async function generateStaticParams() {
  const [popular, topRated, onTheAir] = await Promise.all([
    fetchTMDBData("/tv/popular", { language: "en-US" }),
    fetchTMDBData("/tv/top_rated", { language: "en-US" }),
    fetchTMDBData("/tv/on_the_air", { language: "en-US" }),
  ]);

  const allShows = [
    ...((popular.results as MediaItem[]) || []),
    ...((topRated.results as MediaItem[]) || []),
    ...((onTheAir.results as MediaItem[]) || []),
  ].filter((show) => !isTalkShow(show));

  const uniqueShows = Array.from(
    new Map(allShows.map((show) => [show.id, show])).values(),
  );

  return uniqueShows.slice(0, 60).map((show) => ({
    id: show.id.toString(),
  }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const tvShow = await getCachedTvShowDetail(params.id).catch(() => null);

  return generateMediaMetadata({
    media: tvShow,
    mediaType: "tv",
    mediaId: params.id,
  });
}

export default async function TVShowSeriesGraphPage(props: Props) {
  const { id } = await props.params;
  const details = await getCachedTvShowDetail(id).catch(() => null);
  if (!details) {
    notFound();
  }

  const allSeasonDetails = await fetchAllSeasonDetails(id, details.seasons);

  return <TvShowSeasonsPage allSeasonDetails={allSeasonDetails} />;
}
