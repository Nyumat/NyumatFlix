import { FAQSection } from "@/components/layout/sections/faq";
import { HeroSection } from "@/components/layout/sections/hero";
import { AggressivePrefetchProvider } from "@/components/providers/aggressive-prefetch-provider";

export const metadata = {
  title: "NyumatFlix | Watch Movies and TV Shows",
  description:
    "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": 0,
      "max-image-preview": "large",
      "max-snippet": 150,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "NyumatFlix | Watch Movies and TV Shows",
    description:
      "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
    images: [
      {
        url: "https://nyumatflix.com/og.webp",
        width: 1200,
        height: 630,
        alt: "NyumatFlix | Watch Movies and TV Shows",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "/",
    title: "NyumatFlix | Watch Movies and TV Shows",
    description:
      "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
    images: ["https://nyumatflix.com/og.webp"],
  },
};

export default function Home() {
  return (
    <AggressivePrefetchProvider enableImmediate={true}>
      <HeroSection />
      <FAQSection />
    </AggressivePrefetchProvider>
  );
}
