import { fetchTMDBData } from "@/app/actions";
import { MediaErrorPage } from "@/components/media/media-error-page";
import { MediaNotFoundError } from "@/components/media/media-not-found-error";
import {
  fetchSeasonDetailsServer,
  fetchTVShowDetails,
} from "@/components/tvshow/tvshow-api";
import { TVShowClientWrapper } from "@/components/tvshow/tvshow-client-wrapper";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
import { generateMediaMetadata } from "@/utils/media-metadata-helpers";
import { MediaItem, Season, SeasonDetails } from "@/utils/typings";
import { Metadata } from "next";
export const revalidate = 3600;
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
  const tvShow = await fetchTVShowDetails(params.id);

  return generateMediaMetadata({
    media: tvShow,
    mediaType: "tv",
    mediaId: params.id,
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

export default async function TVShowPage(props: Props) {
  const params = await props.params;
  const { id } = params;

  try {
    const details = await fetchTVShowDetails(id);

    if (!details) {
      return <MediaNotFoundError mediaType="tv" title="TV Show Not Found" />;
    }

    const contentRating =
      details.content_ratings?.results?.find(
        (rating) => rating.iso_3166_1 === "US",
      )?.rating || "";

    const firstAirDate = details.first_air_date
      ? formatDate(details.first_air_date)
      : "Unknown";

    const [anilistId, allSeasonDetails] = await Promise.all([
      getAnilistIdForMedia(details),
      fetchAllSeasonDetails(id, details.seasons),
    ]);

    return (
      <TVShowClientWrapper
        details={details}
        tvId={id}
        firstAirDate={firstAirDate}
        contentRating={contentRating}
        anilistId={anilistId}
        allSeasonDetails={allSeasonDetails}
      />
    );
  } catch {
    return <MediaErrorPage mediaType="tv" title="Error Loading TV Show" />;
  }
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
