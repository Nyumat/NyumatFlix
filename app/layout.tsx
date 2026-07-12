import { JsonLdScript } from "@/components/seo/json-ld-script";
import { buildWebsiteStructuredData } from "@/lib/seo/structured-data";
import { NavbarClient } from "@/components/layout/nav/navbar-client";
import { RouteScrollReset } from "@/components/layout/route-scroll-reset";
import { FooterSection } from "@/components/layout/sections/footer";
import { AdblockGateProvider } from "@/components/providers/adblock-gate-provider";
import { OnboardingProvider } from "@/components/providers/onboarding-provider";
import { AppSettingsSync } from "@/components/providers/app-settings-sync";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { GlobalDockProvider } from "@/components/layout/dock/global-dock";
import { Toaster } from "@/components/ui/sonner";
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
  UMAMI_CLOUD_WEBSITE_ID,
  UMAMI_URL,
  UMAMI_WEBSITE_ID,
} from "@/lib/constants";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/seo/constants";
import { auth } from "@/auth";
import { FeatureFlagsProvider } from "@/components/providers/feature-flags-provider";
import { getSiteFlags, getDefaultSiteFlags } from "@/lib/flags/site-flags";
import { isFfsHost } from "@/lib/ffs/require-ffs-host";
import { headers } from "next/headers";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const host = (await headers()).get("host");
  const ffsAdminHost = isFfsHost(host);
  let siteFlags = getDefaultSiteFlags();
  try {
    siteFlags = await getSiteFlags();
  } catch (error) {
    console.warn("[layout] getSiteFlags failed:", error);
  }

  const chrome = ffsAdminHost ? (
    <>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <Toaster richColors closeButton />
    </>
  ) : (
    <>
      <AppSettingsSync />
      <GlobalDockProvider>
        <NavbarClient session={session} />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <FooterSection />
        <Toaster richColors closeButton />
      </GlobalDockProvider>
    </>
  );

  return (
    <html
      lang="en"
      className={cn(manrope.variable, "dark")}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "history.scrollRestoration='manual'",
          }}
        />
        {process.env.NODE_ENV === "production" && (
          <>
            <Script
              defer
              src="/assets/client-runtime.js"
              data-host-url={`${SITE_URL}/client`}
              data-website-id={UMAMI_CLOUD_WEBSITE_ID}
              strategy="afterInteractive"
            />
            <Script
              defer
              src={`${UMAMI_URL}/script.js`}
              data-website-id={UMAMI_WEBSITE_ID}
              strategy="afterInteractive"
            />
            <Script
              defer
              src={`${UMAMI_URL}/recorder.js`}
              data-website-id={UMAMI_WEBSITE_ID}
              strategy="afterInteractive"
            />
          </>
        )}
      </head>
      <body className={cn("flex min-h-dvh flex-col bg-background font-sans")}>
        <JsonLdScript data={buildWebsiteStructuredData()} />
        <RouteScrollReset />
        <QueryProvider>
          <FeatureFlagsProvider flags={siteFlags}>
            <AuthSessionProvider session={session}>
              <OnboardingProvider>
                <TooltipProvider>
                  <AdblockGateProvider>{chrome}</AdblockGateProvider>
                </TooltipProvider>
              </OnboardingProvider>
            </AuthSessionProvider>
          </FeatureFlagsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
