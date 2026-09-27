import { fetchOgTvDetail } from "@/lib/seo/og-tmdb-fetch";
import { resolveMediaOgImageProps } from "@/lib/seo/og-remote-image";
import {
  getMediaOgImageProps,
  MediaOgImage,
  OG_IMAGE_SIZE,
  ogImageContentType,
} from "@/lib/seo/og-image";
import { renderCachedOgImage } from "@/lib/seo/og-render";
import { applyHubDayCacheLife } from "@/lib/server/route-cache-life";

export const alt = "TV show on NyumatFlix";
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  "use cache";
  applyHubDayCacheLife();

  const { id } = await params;

  return renderCachedOgImage(`tv:${id}`, async () => {
    const tvShow = await fetchOgTvDetail(id);

    if (!tvShow) {
      return <MediaOgImage label="SERIES" title="TV Show Not Found" />;
    }

    const props = await resolveMediaOgImageProps(
      getMediaOgImageProps(tvShow, "tv"),
    );

    return <MediaOgImage {...props} />;
  });
}
