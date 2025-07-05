import { CommunitySection } from "@/components/layout/sections/community";
import { FAQSection } from "@/components/layout/sections/faq";
import { HeroSection } from "@/components/layout/sections/hero";
import { WhyNyumatFlix } from "@/components/layout/sections/why";
import { AggressivePrefetchProvider } from "@/components/providers/aggressive-prefetch-provider";

export const metadata = {
  title: "NyumatFlix - Movies and TV Shows, Anytime, Anywhere",
  description:
    "NyumatFlix is the best place to watch movies and TV shows online. With our platform, you can watch anywhere, anytime, on any device.",
  openGraph: {
    type: "website",
    url: "https://nyumatflix.com",
    title: "NyumatFlix - Movies and TV Shows, Anytime, Anywhere",
    description:
      "NyumatFlix is the best place to watch movies and TV shows online. With our platform, you can watch anywhere, anytime, on any device.",
    images: [
      {
        url: "https://nyumatflix.com/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "NyumatFlix - Movies and TV Shows, Anytime, Anywhere",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com",
    title: "NyumatFlix - Movies and TV Shows, Anytime, Anywhere",
    description:
      "NyumatFlix is the best place to watch movies and TV shows online. With our platform, you can watch anywhere, anytime, on any device.",
    images: ["https://nyumatflix.com/opengraph-image.png"],
  },
};

export default function Home() {
  return (
    <AggressivePrefetchProvider enableImmediate={true}>
      <HeroSection />
      <WhyNyumatFlix />
      <CommunitySection />
      <FAQSection />
    </AggressivePrefetchProvider>
  );
}
