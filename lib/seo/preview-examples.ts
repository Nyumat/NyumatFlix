import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import { truncateDescription } from "@/lib/seo/metadata";
import { generateMediaMetadata } from "@/utils/media-metadata-helpers";

export type SeoPreviewExample = {
  id: string;
  label: string;
  title: string;
  description: string;
};

const POPULAR_MOVIE_IDS = [
  { id: "550", label: "Fight Club" },
  { id: "157336", label: "Interstellar" },
  { id: "278", label: "The Shawshank Redemption" },
] as const;

const POPULAR_TV_IDS = [
  { id: "1399", label: "Game of Thrones" },
  { id: "94997", label: "House of the Dragon" },
  { id: "66732", label: "Stranger Things" },
] as const;

const OG_PREVIEW_EXAMPLES = [
  { type: "movie" as const, id: "550", label: "Fight Club" },
  { type: "tv" as const, id: "1399", label: "Game of Thrones" },
  { type: "person" as const, id: "287", label: "Brad Pitt" },
  { type: "collection" as const, id: "131296", label: "Deadpool Collection" },
];

const metadataTitle = (metadata: { title?: unknown }) => {
  if (typeof metadata.title === "string") return metadata.title;
  return "Untitled";
};

const metadataDescription = (metadata: { description?: unknown }) =>
  typeof metadata.description === "string" ? metadata.description : "";

export const getOgPreviewExamples = () => OG_PREVIEW_EXAMPLES;

export const getPopularMovieSeoExamples = async (): Promise<
  SeoPreviewExample[]
> => {
  const results = await Promise.all(
    POPULAR_MOVIE_IDS.map(async ({ id, label }) => {
      const media = await getCachedMovieDetail(id);
      const metadata = await generateMediaMetadata({
        media,
        mediaType: "movie",
        mediaId: id,
      });

      return {
        id,
        label,
        title: metadataTitle(metadata),
        description:
          metadataDescription(metadata) || `Watch ${label} on NyumatFlix.`,
      };
    }),
  );

  return results;
};

export const getPopularTvSeoExamples = async (): Promise<
  SeoPreviewExample[]
> => {
  const results = await Promise.all(
    POPULAR_TV_IDS.map(async ({ id, label }) => {
      const media = await getCachedTvShowDetail(id).catch(() => null);
      const metadata = await generateMediaMetadata({
        media,
        mediaType: "tv",
        mediaId: id,
      });

      return {
        id,
        label,
        title: metadataTitle(metadata),
        description:
          metadataDescription(metadata) ||
          truncateDescription(`Watch ${label} on NyumatFlix.`),
      };
    }),
  );

  return results;
};
