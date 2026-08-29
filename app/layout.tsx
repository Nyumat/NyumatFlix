import { ApiFetchBootstrap } from "@/components/providers/api-fetch-bootstrap";
import { CapWarmup } from "@/components/cap/cap-warmup";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { buildWebsiteStructuredData } from "@/lib/seo/structured-data";
import { AppChrome } from "@/components/layout/app-chrome";
import { RouteScrollReset } from "@/components/layout/route-scroll-reset";
import { AdblockGateProvider } from "@/components/providers/adblock-gate-provider";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { HoverSoundProvider } from "@/components/providers/hover-sound-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/lib/query-client";
import { cn, validateEnv } from "@/lib/utils";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import {
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  UMAMI_URL,
  UMAMI_WEBSITE_ID,
} from "@/lib/constants";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/seo/constants";
import { DevtoolsTrollProvider } from "@/components/providers/devtools-troll-provider";
import { FeatureFlagsProvider } from "@/components/providers/feature-flags-provider";
import { getCdnOrigin } from "@/lib/cdn";

const manrope = Manrope({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-manrope",
  display: "swap",
});

if (process.env.NODE_ENV !== "production") {
  validateEnv();
}

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: `${SITE_NAME} | ${SITE_TAGLINE}`,
  description: DEFAULT_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", type: "image/x-icon" },
      { url: "/icon.png?v=2", sizes: "256x256", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=2",
    apple: [
      {
        url: "/apple-touch-icon.png?v=2",
        sizes: "180x180",
        type: "image/png",
      },
      {
        url: "/apple-touch-icon-120x120.png?v=2",
        sizes: "120x120",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        type: DEFAULT_OG_IMAGE_TYPE,
        alt: `${SITE_NAME} | ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(manrope.variable, "dark")}
      suppressHydrationWarning
    >
      <head>
        {getCdnOrigin() ? (
          <link
            rel="preconnect"
            href={getCdnOrigin()}
            crossOrigin="anonymous"
          />
        ) : null}
        <script
          dangerouslySetInnerHTML={{
            __html: "history.scrollRestoration='manual'",
          }}
        />
        {process.env.NODE_ENV === "production" && (
          <>
            <Script
              id="umami-recorder-sample"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `(function(){try{if(Math.random()>=0.05)return;var s=document.createElement('script');s.defer=true;s.src=${JSON.stringify(`${UMAMI_URL}/recorder.js`)};s.dataset.websiteId=${JSON.stringify(UMAMI_WEBSITE_ID)};document.head.appendChild(s);}catch(e){}})();`,
              }}
            />
            <Script
              defer
              src={`${UMAMI_URL}/script.js`}
              data-website-id={UMAMI_WEBSITE_ID}
              strategy="afterInteractive"
            />
          </>
        )}
      </head>
      <body className={cn("flex min-h-dvh flex-col bg-background font-sans")}>
        <JsonLdScript data={buildWebsiteStructuredData()} />
        <ApiFetchBootstrap />
        <CapWarmup />
        <RouteScrollReset />
        <QueryProvider>
          <FeatureFlagsProvider>
            <AuthSessionProvider>
              <TooltipProvider>
                <AdblockGateProvider>
                  <HoverSoundProvider>
                    <DevtoolsTrollProvider>
                      <AppChrome>{children}</AppChrome>
                    </DevtoolsTrollProvider>
                  </HoverSoundProvider>
                </AdblockGateProvider>
              </TooltipProvider>
            </AuthSessionProvider>
          </FeatureFlagsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
