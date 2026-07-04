import { createOgImageResponse } from "@/lib/seo/og-image";
import { resolveSiteOgPosterUrls } from "@/lib/seo/og-remote-image";
import { SiteOgImage } from "@/lib/seo/og-image";
import { getSiteOgImageProps } from "@/lib/seo/site-og-showcase";

export const renderSiteOgImageElement = async (origin: string) => {
  const bannerUrl = `${origin}/movie-banner.webp`;
  const props = await getSiteOgImageProps(bannerUrl);
  const resolvedImages = await resolveSiteOgPosterUrls(
    props.posterUrls,
    props.bannerUrl,
  );

  return (
    <SiteOgImage
      title={props.title}
      headline={props.headline}
      posterUrls={resolvedImages.posterUrls}
      bannerUrl={resolvedImages.bannerUrl}
    />
  );
};

export const renderSiteOgImage = async (origin: string) => {
  const element = await renderSiteOgImageElement(origin);
  return createOgImageResponse(element);
};
