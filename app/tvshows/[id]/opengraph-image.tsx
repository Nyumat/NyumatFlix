import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import {
  createOgImageResponse,
  getMediaOgImageProps,
  MediaOgImage,
  OG_IMAGE_SIZE,
  ogImageContentType,
} from "@/lib/seo/og-image";

export const alt = "TV show on NyumatFlix";
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;
  const tvShow = await getCachedTvShowDetail(id).catch(() => null);

  if (!tvShow) {
    return createOgImageResponse(
      <MediaOgImage label="SERIES" title="TV Show Not Found" />,
    );
  }

  const props = getMediaOgImageProps(tvShow, "tv");

  return createOgImageResponse(<MediaOgImage {...props} />);
}
