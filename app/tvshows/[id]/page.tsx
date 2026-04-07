import { TvShowDetailTabPanels } from "@/components/tvshow/tv-show-detail-tab-panels";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import { generateMediaMetadata } from "@/utils/media-metadata-helpers";
import { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamicParams = true;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TvShowDetailPage(props: Props) {
  const { id } = await props.params;

  const details = await getCachedTvShowDetail(id).catch(() => null);
  if (!details) {
    notFound();
  }

  return (
    <TvShowDetailTabPanels
      tvId={id}
      numberOfEpisodes={details.number_of_episodes}
    />
  );
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const tvShow = await getCachedTvShowDetail(id).catch(() => null);
  const base = await generateMediaMetadata({
    media: tvShow,
    mediaType: "tv",
    mediaId: id,
  });
  if (!tvShow || !("name" in tvShow)) return base;
  const year = tvShow.first_air_date
    ? new Date(tvShow.first_air_date).getFullYear()
    : "";
  const nameWithYear = year ? `${tvShow.name} (${year})` : tvShow.name;

  return { ...base, title: `${nameWithYear} | NyumatFlix` };
}

async function fetchAllSeasonDetails(
  tvId: string,
  seasons: Season[] | undefined,
): Promise<Record<number, SeasonDetails>> {
  const regularSeasons =
    seasons?.filter((season: Season) => season.season_number > 0) || [];

  const allSeasonDetailsPromises = regularSeasons.map((season: Season) =>
    fetchSeasonDetailsServer(tvId, season.season_number).catch(() => null),
  );

  const allSeasonDetailsArray = await Promise.all(allSeasonDetailsPromises);
  const allSeasonDetails: Record<number, SeasonDetails> = {};

  allSeasonDetailsArray.forEach((seasonDetail) => {
    if (seasonDetail) {
      allSeasonDetails[seasonDetail.season_number] = seasonDetail;
    }
  });

  return allSeasonDetails;
}
