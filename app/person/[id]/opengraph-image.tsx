import { getPersonDetails } from "@/lib/server/actions";
import {
  createOgImageResponse,
  getPersonOgImageProps,
  OG_IMAGE_SIZE,
  ogImageContentType,
  PersonOgImage,
} from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "Person on NyumatFlix";
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;
  const personId = Number.parseInt(id, 10);

  if (Number.isNaN(personId)) {
    return createOgImageResponse(<PersonOgImage name="Person Not Found" />);
  }

  const person = await getPersonDetails(personId);

  if (!person) {
    return createOgImageResponse(<PersonOgImage name="Person Not Found" />);
  }

  const props = await getPersonOgImageProps(person);

  return createOgImageResponse(<PersonOgImage {...props} />);
}
