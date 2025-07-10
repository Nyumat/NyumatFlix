"use client";
import { GithubIcon } from "@/components/icons/github-icon";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
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
    <section className="w-full pointer-events-none select-none">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-[80vh] lg:min-h-[85vh] gap-6 sm:gap-8 py-8 md:py-16">
          {/* Main Content */}
          <div className="flex flex-col items-center text-center space-y-6 sm:space-y-8 max-w-6xl">
            {/* Title */}
            <div className="max-w-4xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Movies and TV Shows <br />
                <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                  For Everyone.
                </span>
              </h1>
            </div>

            {/* Streaming Services */}
            <div className="w-full max-w-5xl">
              <StreamingServices />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col md:!flex-row items-center justify-center gap-3 md:gap-4 w-full max-w-xs md:max-w-md -translate-y-2">
              <Button
                className="w-full sm:w-auto sm:min-w-[160px] font-bold group/arrow pointer-events-auto select-auto"
                asChild
              >
                <Link href="/home" passHref aria-label="Get Started">
                  Start Watching
                  <ArrowRight className="size-5 ml-2 group-hover/arrow:translate-x-1 transition-transform" />
                </Link>
              </Button>

              <Button
                asChild
                variant="secondary"
                className="w-full sm:w-auto sm:min-w-[160px] font-bold pointer-events-auto select-auto"
              >
                <Link
                  href="https://github.com/nyumat/nyumatflix"
                  target="_blank"
                >
                  GitHub
                  <GithubIcon className="size-5 ml-2" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Adblocker Section */}
          <div className="flex flex-col items-center gap-4 sm:gap-6 pointer-events-auto select-auto max-w-4xl">
            <p className="text-sm text-muted-foreground text-center px-4">
              I recommend using one of the adblockers below for the best
              experience.
            </p>

            <div className="flex flex-col items-center gap-3 sm:gap-4">
              {/* Adblocker Icons */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
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
                          width={24}
                          height={24}
                          priority
                          className="w-6 h-6"
                        />
                        <Image
                          src="/firefox.svg"
                          alt="Firefox"
                          width={24}
                          height={24}
                          priority
                          className="w-6 h-6"
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
                          width={24}
                          height={24}
                          priority
                          className="w-6 h-6"
                        />
                        <Image
                          src="/safari.svg"
                          alt="Safari"
                          width={24}
                          height={24}
                          priority
                          className="w-6 h-6"
                        />
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Get AdGuard for Safari
                  </TooltipContent>
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
                          width={24}
                          height={24}
                          priority
                          className="w-6 h-6"
                        />
                        <Image
                          src="/chrome.svg"
                          alt="Chrome"
                          width={24}
                          height={24}
                          priority
                          className="w-6 h-6"
                        />
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Get uBlock Origin for Chrome
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Help Link */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="https://www.reddit.com/r/Adblock/comments/1j6f099/to_all_those_asking_how_to_enable_ublock_origin/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="How to enable uBlock Origin again"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Can&apos;t download on Chrome?
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top">
                  How to enable uBlock Origin again
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Preview Image */}
          <div className="relative w-full max-w-6xl mt-8 sm:mt-12 lg:mt-16">
            <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-24 lg:h-80 bg-fuchsia-600/20 rounded-full blur-3xl"></div>
            <div onContextMenu={(e) => e.preventDefault()}>
              <div className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-background border md:shadow-xl border-primary/30 p-2">
                <div className="relative block md:hidden">
                  <Image
                    width={768}
                    height={1680}
                    className="pointer-events-none select-none object-cover w-full h-auto"
                    src="/mobile.png"
                    priority
                    alt="NyumatFlix on Mobile"
                  />
                </div>
                <div className="relative hidden md:block">
                  <Image
                    width={1920}
                    height={1080}
                    className="pointer-events-none select-none object-cover w-full h-auto"
                    priority
                    src="/preview.webp"
                    alt="NyumatFlix Platform"
                  />
                </div>

                <BorderBeam
                  duration={10}
                  size={400}
                  borderWidth={2}
                  colorFrom="#103AC1"
                  colorTo="#8B2AD4"
                  className="from-transparent via-fuchsia-600 to-transparent"
                />
                <BorderBeam
                  duration={10}
                  delay={5}
                  size={400}
                  borderWidth={2}
                  colorFrom="#103AC1"
                  colorTo="#8B2AD4"
                  className="from-transparent via-fuchsia-600 to-transparent"
                />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-20 md:h-28 bg-gradient-to-b from-background/0 via-background/60 to-background rounded-lg"></div>
            <div className="absolute bottom-0 left-0 w-full h-20 md:h-28 bg-gradient-to-b from-background/0 via-background/60 to-background rounded-lg"></div>
          </div>
        </div>
      </div>
    </section>
  );
};
