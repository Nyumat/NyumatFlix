import { SITE_NAME } from "@/lib/constants";
import { OG_IMAGE_SIZE, ogImageContentType } from "@/lib/seo/og-image";
import {
  ogImageRouteRevalidate,
  renderCachedOgImage,
} from "@/lib/seo/og-render";
import { renderSiteOgImageElement } from "@/lib/seo/site-og-image";
import { headers } from "next/headers";

export const alt = SITE_NAME;
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;
export const revalidate = ogImageRouteRevalidate;

const getRequestOrigin = async () => {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "nyumatflix.com";
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
};

export default async function Image() {
  const origin = await getRequestOrigin();

  return renderCachedOgImage(`site:${origin}`, async () =>
    renderSiteOgImageElement(origin),
  );
}
