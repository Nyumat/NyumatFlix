import {
  createOgImageResponse,
  SiteOgImage,
  OG_IMAGE_SIZE,
  ogImageContentType,
} from "@/lib/seo/og-image";
import { SITE_HERO_BANNER_PATH } from "@/lib/constants";
import { getSiteOgImageProps } from "@/lib/seo/site-og-showcase";

export const runtime = "edge";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const bannerUrl = `${origin}${SITE_HERO_BANNER_PATH}`;
  const props = await getSiteOgImageProps(bannerUrl);
  return createOgImageResponse(<SiteOgImage {...props} />);
}
