"use client";

import AdblockerAlert from "@/components/content/adblocker-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";
import { useDetectAdBlock } from "adblock-detect-react";
import { ArrowRight, Search } from "lucide-react";
import Image from "next/legacy/image";
import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useState } from "react";

interface StreamingService {
  filePath: string;
  name: string;
}

const services: StreamingService[] = [
  {
    filePath: "/peacock.svg",
    name: "Peacock",
  },
  {
    filePath: "/hbomax.svg",
    name: "HBO Max",
  },
  {
    filePath: "/hulu.svg",
    name: "Hulu",
  },
  {
    filePath: "/netflix.svg",
    name: "Netflix",
  },
  {
    filePath: "/appletvplus.svg",
    name: "Apple TV",
  },
  {
    filePath: "/disneyplus.svg",
    name: "Disney+",
  },
  {
    filePath: "/primevideo.svg",
    name: "Prime Video",
  },
];

export default function Sponsors() {
  const [query, setQuery] = useState("");
  const [adblockAlertTrigger, setAdblockAlertTrigger] =
    useState<boolean>(false);
  const router = useRouter();
  const adBlockDetected = useDetectAdBlock();

  useLayoutEffect(() => {
    router.prefetch("/search");
  }, [router]);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      if (adBlockDetected) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        return;
      }

      setAdblockAlertTrigger(true);
    }
  }, [query, router, adBlockDetected]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  return (
    <section
      id="sponsors"
      className="w-full max-w-full mx-auto overflow-hidden"
    >
      <AdblockerAlert
        openSignal={adblockAlertTrigger}
        data-testid="hero-search-adblocker-alert"
        onProceed={() => {
          if (query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
          }
        }}
      />
      <div className="max-w-lg mx-auto px-4 mt-4 mb-6 pointer-events-auto scale-90 md:scale-110">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-white/70 h-7 w-7 z-10 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search movies, TV shows..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className={cn(
                "pl-16 pr-20 py-5 text-base md:text-xl w-full rounded-xl",
                "backdrop-blur-md bg-white/10 border border-white/20",
                "text-white placeholder:text-white/60 focus:outline-none",
              )}
              data-testid="hero-search-input"
            />
            <Button
              type="submit"
              disabled={!query.trim()}
              variant="chrome"
              aria-label="Search"
              size="icon"
              className="size-10 absolute right-2 top-1/2 transform -translate-y-1/2 scale-75"
            >
              <ArrowRight className="size-5" />
            </Button>
          </div>
        </form>
      </div>

      <div className="w-full overflow-hidden">
        <Marquee
          className="gap-[2rem] sm:gap-[3rem]"
          fade
          innerClassName="gap-[2rem] sm:gap-[3rem]"
        >
          {services.map(({ filePath, name }) => (
            <div
              key={name}
              className="flex flex-col items-center text-xl md:text-2xl font-medium select-none pointer-events-none"
            >
              <Image
                src={filePath}
                alt={name}
                width={80}
                height={80}
                className="flex-none w-16 h-16 sm:w-20 sm:h-20 grayscale select-none pointer-events-none"
                unselectable="on"
              />
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
