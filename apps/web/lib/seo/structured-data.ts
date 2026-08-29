import type { MediaItem } from "@/lib/domain/typings";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { buildCanonicalUrl, tmdbImageUrl } from "./constants";

const getMediaTitle = (media: MediaItem, mediaType: "movie" | "tv") =>
  mediaType === "tv" && "name" in media ? media.name : media.title || "";

const getMediaDate = (media: MediaItem, mediaType: "movie" | "tv") => {
  if (mediaType === "tv" && "first_air_date" in media) {
    return media.first_air_date || undefined;
  }
  if ("release_date" in media) {
    return media.release_date || undefined;
  }
  return undefined;
};

export const buildMovieStructuredData = (media: MediaItem, mediaId: string) => {
  const title = getMediaTitle(media, "movie");
  const releaseDate = getMediaDate(media, "movie");
  const image = tmdbImageUrl(media.poster_path, "w500");

  return {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: title,
    description: media.overview,
    url: buildCanonicalUrl(`/movies/${mediaId}`),
    ...(releaseDate && { datePublished: releaseDate }),
    ...(image && { image }),
    ...(media.vote_average > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: media.vote_average.toFixed(1),
        ratingCount: media.vote_count,
        bestRating: "10",
        worstRating: "0",
      },
    }),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
};

export const buildTvStructuredData = (media: MediaItem, mediaId: string) => {
  const title = getMediaTitle(media, "tv");
  const startDate = getMediaDate(media, "tv");
  const image = tmdbImageUrl(media.poster_path, "w500");

  return {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: title,
    description: media.overview,
    url: buildCanonicalUrl(`/tvshows/${mediaId}`),
    ...(startDate && { datePublished: startDate }),
    ...(image && { image }),
    ...(media.vote_average > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: media.vote_average.toFixed(1),
        ratingCount: media.vote_count,
        bestRating: "10",
        worstRating: "0",
      },
    }),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
};

export const buildPersonStructuredData = (
  person: {
    name?: string;
    biography?: string | null;
    profile_path?: string | null;
    birthday?: string | null;
    deathday?: string | null;
    place_of_birth?: string | null;
    known_for_department?: string | null;
  },
  personId: number,
) => {
  const image = tmdbImageUrl(person.profile_path, "w500");

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    url: buildCanonicalUrl(`/person/${personId}`),
    ...(person.biography && { description: person.biography }),
    ...(image && { image }),
    ...(person.birthday && { birthDate: person.birthday }),
    ...(person.deathday && { deathDate: person.deathday }),
    ...(person.place_of_birth && { birthPlace: person.place_of_birth }),
    ...(person.known_for_department && {
      jobTitle: person.known_for_department,
    }),
  };
};

export const buildWebsiteStructuredData = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description:
    "Open-source, no-cost, and ad-free movie and TV stream aggregator.",
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
});
