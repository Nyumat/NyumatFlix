import { Navbar } from "@/components/layout/navbar";
import { FooterSection } from "@/components/layout/sections/footer";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
const inter = Inter({ subsets: ["latin"] });

const resolveBase = () =>
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://nyumatflix.com";

export const metadata: Metadata = {
  metadataBase: new URL(resolveBase()),
  title: "NyumatFlix - Watch Movies and TV Shows Online",
  description:
    "Tired of Netflix? Try NyumatFlix! Watch movies and TV shows online for free.",
  openGraph: {
    images: [
      {
        url: "https://nyumatflix.com/preivew.png",
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background flex flex-col",
          inter.className,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <TooltipProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <FooterSection />
            <Toaster richColors closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
