import { fetchOgMovieDetail } from "@/lib/seo/og-tmdb-fetch";
import { resolveMediaOgImageProps } from "@/lib/seo/og-remote-image";
import {
  getMediaOgImageProps,
  MediaOgImage,
  OG_IMAGE_SIZE,
  ogImageContentType,
} from "@/lib/seo/og-image";
import { renderCachedOgImage } from "@/lib/seo/og-render";

export const alt = "Movie on NyumatFlix";
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;
export const revalidate = 86400; // OG_IMAGE_REVALIDATE_SECONDS

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;

  return renderCachedOgImage(`movie:${id}`, async () => {
    const movie = await fetchOgMovieDetail(id);

    if (!movie) {
      return <MediaOgImage label="FILM" title="Movie Not Found" />;
    }

    const props = await resolveMediaOgImageProps(
      getMediaOgImageProps(movie, "movie"),
    );

    return <MediaOgImage {...props} />;
  });
}
