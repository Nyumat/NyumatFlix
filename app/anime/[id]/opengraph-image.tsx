import { fetchOgTvDetail } from "@/lib/seo/og-tmdb-fetch";
import { resolveMediaOgImageProps } from "@/lib/seo/og-remote-image";
import {
  getMediaOgImageProps,
  MediaOgImage,
  OG_IMAGE_SIZE,
  ogImageContentType,
} from "@/lib/seo/og-image";
import { renderCachedOgImage } from "@/lib/seo/og-render";

export const alt = "Anime on NyumatFlix";
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;
export const revalidate = 86400; // OG_IMAGE_REVALIDATE_SECONDS

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;

  return renderCachedOgImage(`anime:${id}`, async () => {
    const tvShow = await fetchOgTvDetail(id);

    if (!tvShow) {
      return <MediaOgImage label="SERIES" title="Anime Not Found" />;
    }

    const props = await resolveMediaOgImageProps(
      getMediaOgImageProps(tvShow, "tv"),
    );

    return <MediaOgImage {...props} />;
  });
}
