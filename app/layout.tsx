import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn, isBrowser } from "@/lib/utils";
import { MarketingNavbar, Navbar } from "@/components/layout/navbar";
import { ThemeProvider } from "@/components/layout/theme-provider";
const inter = Inter({ subsets: ["latin"] });
import { headers } from "next/headers";
import { pathname } from "next-extra/pathname";

export const metadata: Metadata = {
  title: "NyumatFlix - Watch Movies and TV Shows Online",
  description:
    "Tired of Netflix? Try NyumatFlix! Watch movies and TV shows online for free.",
  openGraph: {
    images: [
      {
        url: "https://nyumatflix.com/preivew.jpg",
        width: 1200,
        height: 630,
        alt: "NyumatFlix - Watch Movies and TV Shows Online",
      },
    ],
    tags: ["movies", "tv shows", "streaming", "watch online", "free"],
    description:
      "Tired of Netflix? Try NyumatFlix! Watch movies and TV shows online for free.",
    siteName: "NyumatFlix",
    title: "NyumatFlix - Watch Movies and TV Shows Online",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const base = `${headers().get("x-forwarded-proto")}://${headers().get("host")}`;
  const fullUrl = new URL(pathname(), base);
  const isMarketing = fullUrl.pathname === "/";
  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background", inter.className)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />

          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
