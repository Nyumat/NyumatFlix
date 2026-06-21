import type { MediaItem } from "@/lib/domain/typings";
import { buildMediaDescription } from "@/lib/seo/media-description";
import { buildNotFoundMetadata, buildPageMetadata } from "@/lib/seo/metadata";
import type { Metadata } from "next";

type GenerateMediaMetadataOptions = {
  media: MediaItem | null;
  mediaType: "movie" | "tv";
  mediaId: string;
  notFoundTitle?: string;
  notFoundDescription?: string;
};

const getMediaTitle = (media: MediaItem, mediaType: "movie" | "tv"): string => {
  if (mediaType === "tv" && "name" in media && typeof media.name === "string") {
    return media.name;
  }
  if ("title" in media && typeof media.title === "string" && media.title) {
    return media.title;
  }
  return mediaType === "movie" ? "Movie" : "TV Show";
};

const getMediaDate = (media: MediaItem, mediaType: "movie" | "tv") => {
  if (mediaType === "tv" && "first_air_date" in media) {
    return media.first_air_date || null;
  }
  if ("release_date" in media) {
    return media.release_date || null;
  }
  return null;
};

export async function generateMediaMetadata({
  media,
  mediaType,
  mediaId,
  notFoundTitle,
  notFoundDescription,
}: GenerateMediaMetadataOptions): Promise<Metadata> {
  if (!media) {
    return buildNotFoundMetadata(
      notFoundTitle ||
        `${mediaType === "movie" ? "Movie" : "TV Show"} Not Found`,
    );
  }

  const title = getMediaTitle(media, mediaType);
  const tagline =
    "tagline" in media && typeof media.tagline === "string"
      ? media.tagline
      : undefined;
  const description = buildMediaDescription({
    tagline,
    overview: media.overview,
    fallback: `Watch ${title} on NyumatFlix`,
  });
  const dateField = getMediaDate(media, mediaType);
  const year = dateField ? new Date(dateField).getFullYear() : "";
  const titleWithYear = year ? `${title} (${year})` : title;
  const path =
    mediaType === "movie" ? `/movies/${mediaId}` : `/tvshows/${mediaId}`;

  return buildPageMetadata({
    title: titleWithYear,
    description,
    path,
    ogType: "website",
    imageAlt: `${titleWithYear} on NyumatFlix`,
    includeDefaultImage: false,
  });
}
