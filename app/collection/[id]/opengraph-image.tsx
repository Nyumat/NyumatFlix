import { tmdb } from "@/tmdb/api";
import { resolveCollectionOgImageProps } from "@/lib/seo/og-remote-image";
import {
  CollectionOgImage,
  DefaultOgImage,
  getCollectionOgImageProps,
  OG_IMAGE_SIZE,
  ogImageContentType,
} from "@/lib/seo/og-image";
import {
  ogImageRouteRevalidate,
  renderCachedOgImage,
} from "@/lib/seo/og-render";

export const alt = "Collection on NyumatFlix";
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;
export const revalidate = ogImageRouteRevalidate;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;

  return renderCachedOgImage(`collection:${id}`, async () => {
    const collection = await tmdb.collection.details({ id }).catch(() => null);

    if (!collection) {
      return <DefaultOgImage title="Collection Not Found" />;
    }

    const props = await resolveCollectionOgImageProps(
      getCollectionOgImageProps(collection),
    );

    return <CollectionOgImage {...props} />;
  });
}
