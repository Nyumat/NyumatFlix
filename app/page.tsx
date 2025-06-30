import { CommunitySection } from "@/components/layout/sections/community";
import { FAQSection } from "@/components/layout/sections/faq";
import { HeroSection } from "@/components/layout/sections/hero";
import StreamingServices from "@/components/layout/sections/steaming-services";
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
        url: "https://private-user-images.githubusercontent.com/46255836/363836505-1676fdb1-96ed-47af-9a65-9749e20eca4e.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MjUzNDkyNzksIm5iZiI6MTcyNTM0ODk3OSwicGF0aCI6Ii80NjI1NTgzNi8zNjM4MzY1MDUtMTY3NmZkYjEtOTZlZC00N2FmLTlhNjUtOTc0OWUyMGVjYTRlLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA5MDMlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwOTAzVDA3MzYxOVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWI1ZjJhNWVlY2E2MWMzMTM3MmE5YTk2NWQzNDU2YWM0YjUyYmYxMGUyOGRkYzc1YjVlNjZjMTY4Nzg2OWI1NzQmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.6Bg6s0lPrq3jyjh-jc8Smx6BNmwDHwTbm__-uuZ9wwY",
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
    images: [
      "https://private-user-images.githubusercontent.com/46255836/363836505-1676fdb1-96ed-47af-9a65-9749e20eca4e.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MjUzNDkyNzksIm5iZiI6MTcyNTM0ODk3OSwicGF0aCI6Ii80NjI1NTgzNi8zNjM4MzY1MDUtMTY3NmZkYjEtOTZlZC00N2FmLTlhNjUtOTc0OWUyMGVjYTRlLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA5MDMlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwOTAzVDA3MzYxOVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWI1ZjJhNWVlY2E2MWMzMTM3MmE5YTk2NWQzNDU2YWM0YjUyYmYxMGUyOGRkYzc1YjVlNjZjMTY4Nzg2OWI1NzQmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.6Bg6s0lPrq3jyjh-jc8Smx6BNmwDHwTbm__-uuZ9wwY",
    ],
  },
};

export default function Home() {
  return (
    <AggressivePrefetchProvider enableImmediate={true}>
      <HeroSection />
      <StreamingServices />
      <WhyNyumatFlix />
      <CommunitySection />
      <FAQSection />
    </AggressivePrefetchProvider>
  );
}
