import { renderSiteOgImage } from "@/lib/seo/site-og-image";

export const runtime = "edge";

export async function GET(request: Request) {
  return renderSiteOgImage(new URL(request.url).origin);
}
