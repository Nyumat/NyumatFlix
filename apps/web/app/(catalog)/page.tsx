import { CatalogHubLoading } from "@/components/layout/page-loading/catalog-hub-loading";
import { HomeHubPage } from "@/components/home/home-hub-page";
import { siteConfig } from "@/config/site";
import { SITE_URL } from "@/lib/constants";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/seo/constants";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Home | NyumatFlix",
  description: siteConfig.description,
  openGraph: {
    type: "website",
    url: `${SITE_URL}/`,
    title: "Home | NyumatFlix",
    description: siteConfig.description,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        type: DEFAULT_OG_IMAGE_TYPE,
        alt: "NyumatFlix",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE_URL,
    title: "Home | NyumatFlix",
    description: siteConfig.description,
    images: [DEFAULT_OG_IMAGE],
  },
};

export const instant = false;

export default function Home() {
  return (
    <Suspense fallback={<CatalogHubLoading withPageContainer={false} />}>
      <HomeHubPage />
    </Suspense>
  );
}
