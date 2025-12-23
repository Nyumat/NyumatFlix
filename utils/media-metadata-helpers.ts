import { Metadata } from "next";
import { MediaItem } from "./typings";

type GenerateMediaMetadataOptions = {
  media: MediaItem | null;
  mediaType: "movie" | "tv";
  mediaId: string;
  notFoundTitle?: string;
  notFoundDescription?: string;
};

export async function generateMediaMetadata({
  media,
  mediaType,
  mediaId,
  notFoundTitle,
  notFoundDescription,
}: GenerateMediaMetadataOptions): Promise<Metadata> {
  if (!media) {
    return {
      title:
        notFoundTitle ||
        `${mediaType === "movie" ? "Movie" : "TV Show"} Not Found | NyumatFlix`,
      description:
        notFoundDescription ||
        `The requested ${mediaType === "movie" ? "movie" : "TV show"} could not be found.`,
    };
  }

  const title =
    mediaType === "tv" && "name" in media ? media.name : media.title || "";
  const description = media.overview || `Watch ${title} on NyumatFlix`;

  const dateField =
    mediaType === "tv" && "first_air_date" in media
      ? media.first_air_date
      : "release_date" in media
        ? media.release_date
        : null;

  const year = dateField ? new Date(dateField).getFullYear() : "";

  const titleWithYear = year
    ? `${title} (${year}) | NyumatFlix`
    : `${title} | NyumatFlix`;

  const ogType = mediaType === "movie" ? "video.movie" : "video.tv_show";
  const backdropPath = media.backdrop_path || "";

  return {
    title: titleWithYear,
    ...(mediaType === "movie" && {
      alternates: {
        canonical: `https://nyumatflix.com/movies/${mediaId}`,
        languages: {
          "en-US": `https://nyumatflix.com/movies/${mediaId}`,
        },
      },
    }),
    description,
    openGraph: {
      title: titleWithYear,
      description,
      type: ogType,
      images: backdropPath
        ? [
            {
              url: `https://image.tmdb.org/t/p/w1280${backdropPath}`,
              width: 1280,
              height: 720,
              alt: String(title || "Media Backdrop"),
            },
          ]
        : [],
    },
    twitter: {
      title: titleWithYear,
      description,
      images: backdropPath
        ? [`https://image.tmdb.org/t/p/w1280${backdropPath}`]
        : [],
    },
  };
}
