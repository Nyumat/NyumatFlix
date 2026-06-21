import { SITE_HERO_BANNER_PATH } from "@/lib/constants";
import { createOgImageResponse, SiteOgImage } from "@/lib/seo/og-image";
import { getSiteOgImageProps } from "@/lib/seo/site-og-showcase";

export const renderSiteOgImage = async (origin: string) => {
  const bannerUrl = `${origin}${SITE_HERO_BANNER_PATH}`;
  const props = await getSiteOgImageProps(bannerUrl);
  return createOgImageResponse(<SiteOgImage {...props} />);
};
