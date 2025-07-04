"use client";
import { GithubIcon } from "@/components/icons/github-icon";
import { Button } from "@/components/ui/button";
import ShineBorder from "@/components/ui/shine-border";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowRight } from "lucide-react";
import Image from "next/legacy/image";
import Link from "next/link";
import StreamingServices from "./steaming-services";

export const HeroSection = () => {
  return (
    <section className="container w-full pointer-events-none select-none">
      <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-8 md:py-16">
        <div className="text-center space-y-8">
          <div className="max-w-screen-md mx-auto text-center text-4xl md:text-6xl font-bold">
            <h1>
              Movies and TV Shows <br />
              <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                For Everyone.
              </span>
            </h1>
          </div>
          <StreamingServices />

          <div className="flex flex-row items-center gap-2 justify-center -translate-y-2">
            <Button
              className="w-[200px] font-bold group/arrow pointer-events-auto select-auto"
              asChild
            >
              <Link href="/home" passHref aria-label="Get Started">
                Start Watching
                <ArrowRight className="size-6 ml-2 group-hover/arrow" />
              </Link>
            </Button>

            <Button
              asChild
              variant="secondary"
              className="w-[200px] font-bold pointer-events-auto select-auto"
            >
              <Link href="https://github.com/nyumat/nyumatflix" target="_blank">
                GitHub
                <GithubIcon className="size-6 ml-2" />
              </Link>
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          I recommend using one of the adblockers below for the best experience.
        </p>
        <div className="flex flex-col items-center gap-2 pointer-events-auto select-auto">
          <div className="flex flex-row items-center justify-center gap-3 w-full">
            {/* Firefox + uBlock Origin */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Get uBlock Origin for Firefox"
                  className="hover:scale-110 transition-transform"
                >
                  <span className="flex items-center gap-0.5 bg-background/80 rounded-lg p-2 border border-border shadow-sm">
                    <Image
                      src="/ublock.svg"
                      alt="uBlock Origin"
                      width={28}
                      height={28}
                      priority
                      className="w-7 h-7"
                    />
                    <Image
                      src="/firefox.svg"
                      alt="Firefox"
                      width={28}
                      height={28}
                      priority
                      className="w-7 h-7"
                    />
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">
                Get uBlock Origin for Firefox
              </TooltipContent>
            </Tooltip>
            {/* Safari + AdGuard */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="https://apps.apple.com/us/app/adguard-for-safari/id1440147259"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Get AdGuard for Safari"
                  className="hover:scale-110 transition-transform"
                >
                  <span className="flex items-center gap-0.5 bg-background/80 rounded-lg p-2 border border-border shadow-sm">
                    <Image
                      src="/adguard.svg"
                      alt="AdGuard"
                      width={28}
                      height={28}
                      priority
                      className="w-7 h-7"
                    />
                    <Image
                      src="/safari.svg"
                      alt="Safari"
                      width={28}
                      height={28}
                      priority
                      className="w-7 h-7"
                    />
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">Get AdGuard for Safari</TooltipContent>
            </Tooltip>
            {/* Chrome + uBlock Origin */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Get uBlock Origin for Chrome"
                  className="hover:scale-110 transition-transform"
                >
                  <span className="flex items-center gap-0.5 bg-background/80 rounded-lg p-2 border border-border shadow-sm">
                    <Image
                      src="/ublock.svg"
                      alt="uBlock Origin"
                      width={28}
                      height={28}
                      priority
                      className="w-7 h-7"
                    />
                    <Image
                      src="/chrome.svg"
                      alt="Chrome"
                      width={28}
                      height={28}
                      priority
                      className="w-7 h-7"
                    />
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">
                Get uBlock Origin for Chrome
              </TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="https://www.reddit.com/r/Adblock/comments/1j6f099/to_all_those_asking_how_to_enable_ublock_origin/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="How to enable uBlock Origin again"
                className="text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
              >
                Can&apos;t download on Chrome?
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">
              How to enable uBlock Origin again
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="relative group mt-14">
          <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-24 lg:h-80 bg-primary/50 rounded-full blur-3xl"></div>
          <div onContextMenu={(e) => e.preventDefault()}>
            <ShineBorder
              className="relative flex h-1/2 w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-background border md:shadow-xl border-primary/30 p-2"
              color={["#103AC1", "#8B2AD4", "#CC44C0"]}
            >
              <div className="relative block md:hidden">
                <Image
                  width={768}
                  height={1680}
                  className="pointer-events-none select-none object-cover"
                  src="/mobile.png"
                  priority
                  alt="NyumatFlix on Mobile"
                />
              </div>
              <div className="relative hidden md:block">
                <Image
                  width={1920}
                  height={1080}
                  className="pointer-events-none select-none object-cover"
                  // TODO: Support light mode?
                  priority
                  src={`/home2.png`}
                  alt="NyumatFlix Platform"
                />
              </div>
            </ShineBorder>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-20 md:h-28 bg-gradient-to-b from-background/0 via-background/60 to-background rounded-lg"></div>
          <div className="absolute bottom-0 left-0 w-full h-20 md:h-28 bg-gradient-to-b from-background/0 via-background/60 to-background rounded-lg"></div>
        </div>
      </div>
    </section>
  );
};
