import CopycatWarning from "@/components/landing/copycat-warning";
import { NavbarServer } from "@/components/layout/nav/navbar-server";
import { FooterSection } from "@/components/layout/sections/footer";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { OnboardingProvider } from "@/components/providers/onboarding-provider";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { GlobalDockProvider } from "@/components/ui/global-dock";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn, validateEnv } from "@/lib/utils";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
const inter = Inter({ subsets: ["latin"] });

if (process.env.NODE_ENV !== "production") {
  validateEnv();
}

export const metadata: Metadata = {
  metadataBase: new URL("https://nyumatflix.com/"),
  title: "NyumatFlix | Watch Movies and TV Shows",
  icons: {
    icon: "/favicon.ico",
  },
  description:
    "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
  openGraph: {
    type: "website",
    url: "https://nyumatflix.com",
    title: "NyumatFlix | Watch Movies and TV Shows",
    description:
      "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
    images: [
      {
        url: "https://nyumatflix.com/og.webp",
        alt: "NyumatFlix | Watch Movies and TV Shows",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com",
    title: "NyumatFlix | Watch Movies and TV Shows",
    description:
      "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
    images: ["https://nyumatflix.com/og.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "production" && (
          <Script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id="679411bf-5cd3-4f57-983d-956d67f033cc"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={cn("min-h-screen bg-background", inter.className)}>
        <AuthSessionProvider>
          <OnboardingProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              forcedTheme="dark"
              disableTransitionOnChange
            >
              <TooltipProvider>
                <GlobalDockProvider>
                  <CopycatWarning />
                  <NavbarServer />
                  <main className="flex-1">{children}</main>
                  <FooterSection />
                  <Toaster richColors closeButton />
                </GlobalDockProvider>
              </TooltipProvider>
            </ThemeProvider>
          </OnboardingProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
