import {
  getCachedMovieDetail,
  getCachedTvShowDetail,
} from "@/lib/media-detail-cache";
import { getPersonDetails } from "@/lib/server/actions";
import {
  CollectionOgImage,
  createOgImageResponse,
  DefaultOgImage,
  getCollectionOgImageProps,
  getMediaOgImageProps,
  getPersonOgImageProps,
  MediaOgImage,
  PersonOgImage,
} from "@/lib/seo/og-image";
import { tmdb } from "@/tmdb/api";
import { notFound } from "next/navigation";

const PREVIEW_TYPES = ["movie", "tv", "person", "collection"] as const;

type PreviewType = (typeof PREVIEW_TYPES)[number];

const isPreviewType = (value: string): value is PreviewType =>
  PREVIEW_TYPES.includes(value as PreviewType);

type Props = {
  params: Promise<{ type: string; id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { type, id } = await params;

  if (!isPreviewType(type)) {
    notFound();
  }

  switch (type) {
    case "movie": {
      const movie = await getCachedMovieDetail(id);
      if (!movie) {
        return createOgImageResponse(
          <MediaOgImage label="FILM" title="Movie Not Found" />,
        );
      }
      const props = getMediaOgImageProps(movie, "movie");
      return createOgImageResponse(<MediaOgImage {...props} />);
    }
    case "tv": {
      const tvShow = await getCachedTvShowDetail(id).catch(() => null);
      if (!tvShow) {
        return createOgImageResponse(
          <MediaOgImage label="SERIES" title="TV Show Not Found" />,
        );
      }
      const props = getMediaOgImageProps(tvShow, "tv");
      return createOgImageResponse(<MediaOgImage {...props} />);
    }
    case "person": {
      const personId = Number.parseInt(id, 10);
      if (Number.isNaN(personId)) notFound();
      const person = await getPersonDetails(personId);
      if (!person) {
        return createOgImageResponse(<PersonOgImage name="Person Not Found" />);
      }
      const props = await getPersonOgImageProps(person);
      return createOgImageResponse(<PersonOgImage {...props} />);
    }
    case "collection": {
      const collection = await tmdb.collection
        .details({ id })
        .catch(() => null);
      if (!collection) {
        return createOgImageResponse(
          <DefaultOgImage title="Collection Not Found" />,
        );
      }
      const props = getCollectionOgImageProps(collection);
      return createOgImageResponse(<CollectionOgImage {...props} />);
    }
    default:
      notFound();
  }
}
