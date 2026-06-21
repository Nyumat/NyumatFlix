import { SITE_NAME } from "@/lib/constants";
import { OG_IMAGE_SIZE, ogImageContentType } from "@/lib/seo/og-image";
import { renderSiteOgImage } from "@/lib/seo/site-og-image";
import { headers } from "next/headers";

export const alt = SITE_NAME;
export const size = OG_IMAGE_SIZE;
export const contentType = ogImageContentType;

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
  return renderSiteOgImage(await getRequestOrigin());
}
