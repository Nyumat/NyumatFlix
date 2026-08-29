import type { Logo } from "@/lib/domain/typings";

export type MediaPeekKind = "movie" | "tv";

export type MediaPeekSeed = {
  title: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  content_rating?: string | null;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
  logo?: Logo;
};

export type MediaPeekTarget = {
  mediaType: MediaPeekKind;
  id: string;
  contentId: number;
  href: string;
  catalog: "anime" | null;
  seed: MediaPeekSeed;
};

const EXTERNAL_HREF = /^https?:\/\//i;
const MOVIE_HREF = /^\/movies\/([^/?#]+)/;
const TV_HREF = /^\/tvshows\/([^/?#]+)/;
const ANIME_HREF = /^\/anime\/([^/?#]+)/;

export const isExternalMediaHref = (href: string) =>
  EXTERNAL_HREF.test(href) || href.includes("anilist.co");

const parseContentId = (raw: string | number): number => {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.abs(raw);
  }
  const digits = String(raw).match(/(\d+)/g);
  if (!digits?.length) return Number.NaN;
  const last = digits[digits.length - 1];
  return last ? Number.parseInt(last, 10) : Number.NaN;
};

export const resolveMediaPeekTarget = (
  item: {
    id: number | string;
    media_type?: string;
    title?: string;
    name?: string;
    href?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    overview?: string;
    vote_average?: number;
    content_rating?: string | null;
    release_date?: string;
    first_air_date?: string;
    runtime?: number;
    genres?: Array<{ id: number; name: string }>;
    logo?: Logo;
  },
  href: string,
): MediaPeekTarget | null => {
  if (!href || isExternalMediaHref(href)) return null;
  if (item.media_type === "person") return null;

  const movieMatch = href.match(MOVIE_HREF);
  const tvMatch = href.match(TV_HREF);
  const animeMatch = href.match(ANIME_HREF);

  let mediaType: MediaPeekKind | null = null;
  let id: string | null = null;
  let catalog: "anime" | null = null;

  if (movieMatch?.[1]) {
    mediaType = "movie";
    id = decodeURIComponent(movieMatch[1]);
  } else if (tvMatch?.[1]) {
    mediaType = "tv";
    id = decodeURIComponent(tvMatch[1]);
  } else if (animeMatch?.[1]) {
    mediaType = "tv";
    id = decodeURIComponent(animeMatch[1]);
    catalog = "anime";
  } else if (item.media_type === "movie" || item.media_type === "tv") {
    mediaType = item.media_type;
    id = String(item.id);
  }

  if (!mediaType || !id) return null;

  const contentId = parseContentId(item.id);
  if (!Number.isFinite(contentId) || contentId <= 0) return null;

  const title = item.title || item.name || "Untitled";

  return {
    mediaType,
    id,
    contentId,
    href,
    catalog,
    seed: {
      title,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      overview: item.overview,
      vote_average: item.vote_average,
      content_rating: item.content_rating,
      release_date: item.release_date,
      first_air_date: item.first_air_date,
      runtime: item.runtime,
      genres: item.genres,
      logo: item.logo,
    },
  };
};
