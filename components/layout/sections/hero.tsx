"use client";
import { GithubIcon } from "@/components/icons/github-icon";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDetectAdBlock } from "adblock-detect-react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/legacy/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import StreamingServices from "./steaming-services";

const NeuralNetworkBackground = dynamic(
  () => import("@/components/ui/neural-network-hero"),
  { ssr: false },
);

export const HeroSection = () => {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [showAdOptions, setShowAdOptions] = useState<boolean>(false);
  const adBlockDetected = useDetectAdBlock();

  useEffect(() => {
    router.prefetch("/home");
  }, [router]);

  const handleStartWatchingClick = useCallback(() => {
    if (adBlockDetected) {
      router.push("/home");
      return;
    }
    setShowAdOptions(false);
    setIsDialogOpen(true);
  }, [adBlockDetected, router]);

  const handleNoThanksClick = useCallback(() => {
    setIsDialogOpen(false);
    router.push("/home");
  }, [router]);

  const handleShowAdblockerClick = useCallback(() => {
    setShowAdOptions(true);
  }, []);

  const adBlockerButtons = useMemo(
    () => (
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
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
            <TooltipContent side="top">Get AdGuard for Safari</TooltipContent>
          </Tooltip>
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
    ),
    [],
  );

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div
          className="w-screen h-screen flex flex-col relative opacity-50"
          suppressHydrationWarning
        >
          <NeuralNetworkBackground />
        </div>
      </div>
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pointer-events-none select-none">
        <div className="flex flex-col items-center justify-center min-h-[80vh] lg:min-h-[85vh] gap-6 sm:gap-8 py-8 md:py-16">
          <div className="flex flex-col items-center text-center space-y-6 sm:space-y-8 max-w-6xl">
            <div className="max-w-4xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-tight text-white drop-shadow-lg">
                Movies and TV Shows <br />
                <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                  For Everyone.
                </span>
              </h1>
            </div>
            <div className="w-full max-w-5xl">
              <StreamingServices />
            </div>
            <div className="flex flex-col md:!flex-row text-xl items-center justify-center gap-3 md:gap-4 w-full max-w-xs md:max-w-md -translate-y-2">
              <Button
                className="w-full sm:w-auto sm:min-w-[160px] font-light group/arrow pointer-events-auto select-auto"
                aria-label="Get Started"
                onClick={handleStartWatchingClick}
              >
                Start Watching
                <ArrowRight className="size-5 ml-2 group-hover/arrow:translate-x-1 transition-transform" />
              </Button>
              <Button
                asChild
                variant="secondary"
                className="w-full sm:w-auto sm:min-w-[160px] font-light pointer-events-auto select-auto"
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
          {/* alert dialog prompting adblock recommendation */}
          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogContent
              role="dialog"
              aria-label="adblock recommendation dialog"
            >
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Are you sure you don&apos;t want an ad-blocker?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-bold text-primary">nyumatflix.com</span>{" "}
                  itself is ad-free. However, the APIs we aggregate from often
                  inject scripts within their iframes to display popups and or
                  ads.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="mt-2">
                <AnimatePresence mode="wait" initial={false}>
                  {!showAdOptions ? (
                    <motion.div
                      key="cta"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-center justify-between gap-3"
                    >
                      <Button
                        variant="default"
                        className="font-bold"
                        onClick={handleShowAdblockerClick}
                        aria-label="Show ad blocker options"
                      >
                        Show me adblockers
                      </Button>
                      <Button
                        variant="outline"
                        className="font-bold"
                        onClick={handleNoThanksClick}
                        aria-label="Proceed without ad blocker"
                      >
                        No thanks, I&apos;m fine with popups
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="options"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      {adBlockerButtons}
                      <div className="mt-4 flex justify-center">
                        <Button
                          variant="outline"
                          className="font-bold"
                          onClick={handleNoThanksClick}
                          aria-label="Continue to home"
                        >
                          No thanks, I&apos;m fine with popups
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <AlertDialogFooter></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex flex-col items-center gap-4 sm:gap-6 pointer-events-auto select-auto max-w-4xl">
            <p className="text-sm font-extralight text-white/80 text-center px-4 drop-shadow-md">
              I recommend using one of the adblockers below for the best
              experience.
            </p>
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="https://www.reddit.com/r/Adblock/comments/1j6f099/to_all_those_asking_how_to_enable_ublock_origin/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="How to enable uBlock Origin again"
                    className="text-xs font-extralight text-white/60 hover:text-primary transition-colors drop-shadow-md"
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
          <div className="relative w-full max-w-6xl mt-8 sm:mt-12 lg:mt-16 hidden md:block">
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
