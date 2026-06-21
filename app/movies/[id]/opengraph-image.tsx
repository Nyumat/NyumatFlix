import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import {
  createOgImageResponse,
  getMediaOgImageProps,
  MediaOgImage,
  OG_IMAGE_SIZE,
  ogImageContentType,
} from "@/lib/seo/og-image";

export const alt = "Movie on NyumatFlix";
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;
  const movie = await getCachedMovieDetail(id);

  if (!movie) {
    return createOgImageResponse(
      <MediaOgImage label="FILM" title="Movie Not Found" />,
    );
  }

  const props = getMediaOgImageProps(movie, "movie");

  return createOgImageResponse(<MediaOgImage {...props} />);
}
