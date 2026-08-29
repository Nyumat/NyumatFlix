import { fetchOgPersonCastCredits } from "@/lib/seo/og-tmdb-fetch";
import { resolvePersonOgImageProps } from "@/lib/seo/og-remote-image";
import {
  getPersonOgImageProps,
  OG_IMAGE_SIZE,
  ogImageContentType,
  PersonOgImage,
} from "@/lib/seo/og-image";
import { renderCachedOgImage } from "@/lib/seo/og-render";
import { tmdb } from "@/tmdb/api";

export const alt = "Person on NyumatFlix";
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;
export const revalidate = 86400; // OG_IMAGE_REVALIDATE_SECONDS

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;
  const personId = Number.parseInt(id, 10);

  if (Number.isNaN(personId)) {
    return renderCachedOgImage("person:invalid", async () => (
      <PersonOgImage name="Person Not Found" />
    ));
  }

  return renderCachedOgImage(`person:${personId}`, async () => {
    const [person, credits] = await Promise.all([
      tmdb.person.detail({ id: String(personId) }).catch(() => null),
      fetchOgPersonCastCredits(personId),
    ]);

    if (!person) {
      return <PersonOgImage name="Person Not Found" />;
    }

    const props = await resolvePersonOgImageProps(
      await getPersonOgImageProps(person, credits),
    );

    return <PersonOgImage {...props} />;
  });
}
