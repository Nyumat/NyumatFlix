import { tmdb } from "@/tmdb/api";
import {
  CollectionOgImage,
  createOgImageResponse,
  DefaultOgImage,
  getCollectionOgImageProps,
  OG_IMAGE_SIZE,
  ogImageContentType,
} from "@/lib/seo/og-image";

export const alt = "Collection on NyumatFlix";
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;
  const collection = await tmdb.collection.details({ id }).catch(() => null);

  if (!collection) {
    return createOgImageResponse(
      <DefaultOgImage title="Collection Not Found" />,
    );
  }

  const props = getCollectionOgImageProps(collection);

  return createOgImageResponse(<CollectionOgImage {...props} />);
}
