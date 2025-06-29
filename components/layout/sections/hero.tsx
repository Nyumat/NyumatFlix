"use client";
import GithubIcon from "@/components/icons/github-icon";
import ShineBorder from "@/components/ui/shine-border";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/legacy/image";
import Link from "next/link";

export const HeroSection = () => {
  return (
    <section className="container w-full pointer-events-none select-none">
      <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
        <div className="text-center space-y-8">
          <Badge variant="outline" className="text-sm py-2" role="note">
            <span className="mr-2 text-primary">
              <Badge>BETA</Badge>
            </span>
            <span> Welcome to NyumatFlix 3.0</span>
          </Badge>

          <div className="max-w-screen-md mx-auto text-center text-4xl md:text-6xl font-bold">
            <h1>
              The Streaming Platform <br />
              <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                For Everyone.
              </span>
            </h1>
          </div>

          <p className="max-w-screen-sm mx-auto text-xl text-muted-foreground">
            The best way to watch your favorite movies and TV shows. Anywhere,
            anytime. And, yes—no subscription/sign-up is required.
          </p>

          <div className="space-y-4 md:space-y-0 md:space-x-4">
            <Button
              className="w-5/6 md:w-1/4 font-bold group/arrow pointer-events-auto select-auto"
              asChild
            >
              <Link href="/home" passHref aria-label="Get Started">
                Get Started
                <ArrowRight className="size-5 ml-2 group-hover/arrow" />
              </Link>
            </Button>

            <Button
              asChild
              variant="secondary"
              className="w-5/6 md:w-1/4 font-bold pointer-events-auto select-auto"
            >
              <Link href="https://github.com/nyumat/nyumatflix" target="_blank">
                GitHub
                <GithubIcon className="size-6 ml-2" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative group mt-14">
          <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-24 lg:h-80 bg-primary/50 rounded-full blur-3xl"></div>
          <div onContextMenu={(e) => e.preventDefault()}>
            <ShineBorder
              className="relative flex h-1/2 w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-black md:shadow-xl border-2 border-primary/30 p-2"
              color={["#103AC1", "#8B2AD4", "#CC44C0"]}
            >
              <div className="relative block md:hidden">
                <Image
                  width={768}
                  height={1680}
                  className="pointer-events-none select-none object-cover"
                  src="/mobile.png"
                  alt="NyumatFlix on Mobile"
                />
              </div>
              <div className="relative hidden md:block">
                <Image
                  width={1920}
                  height={1080}
                  className="pointer-events-none select-none object-cover"
                  // TODO: Support light mode?
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
