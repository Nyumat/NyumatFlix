"use client";

import { SilkShaderBackground } from "@/components/hero/silk-shader-background";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home, RotateCcw, Search } from "lucide-react";
import Link from "next/link";

type AppErrorFallbackProps = {
  reset?: () => void;
  title?: string;
  message?: string;
};

const quickLinks = [
  { href: "/movies", label: "Movies" },
  { href: "/tvshows", label: "TV Shows" },
  { href: "/anime", label: "Anime" },
] as const;

export function AppErrorFallback({
  reset,
  title = "We hit a snag",
  message = "This page couldn't load. Please try again later.",
}: AppErrorFallbackProps) {
  return (
    <div className="relative isolate flex min-h-[calc(100dvh-10rem)] w-full flex-1 flex-col items-center justify-center overflow-x-hidden px-4 py-20 sm:min-h-[calc(100dvh-9rem)] sm:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden bg-background"
      >
        <SilkShaderBackground className="h-full w-full opacity-70" />
        <div className="absolute inset-0 bg-linear-to-b from-black/45 via-background/60 to-background" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-b from-transparent to-background" />
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 22%, rgba(212, 71, 191, 0.16), transparent 68%)",
          }}
        />
      </div>
      <div className="relative z-10 w-full max-w-xl">
        <p
          aria-hidden="true"
          className="pointer-events-none relative z-0 mx-auto w-fit select-none px-2 pb-1 text-center text-[clamp(4.75rem,19vw,8.25rem)] font-bold leading-[1.12] tracking-[-0.04em] text-white/[0.11] sm:leading-[1.08]"
        >
          <span className="inline-block px-1 pt-1 pb-2 bg-linear-to-b from-white/20 via-white/10 to-white/5 bg-clip-text text-transparent">
            500
          </span>
        </p>
        <div
          className={cn(
            "relative z-10 -mt-5 w-full space-y-5 rounded-2xl border border-white/12 bg-black/35 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-xl sm:-mt-8 sm:p-10",
            "supports-backdrop-filter:bg-black/25",
          )}
        >
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {title}
            </h1>
            <p className="text-sm leading-relaxed text-white/70 sm:text-base">
              {message}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            {reset ? (
              <Button
                size="lg"
                className="rounded-full border-white/20 bg-white/95 font-semibold text-black shadow-lg shadow-black/25 hover:bg-white"
                onClick={reset}
                type="button"
              >
                <RotateCcw className="mr-2 size-4" aria-hidden="true" />
                Try again
              </Button>
            ) : null}
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              <Link href="/">
                <Home className="mr-2 size-4" aria-hidden="true" />
                Back to home
              </Link>
            </Button>
          </div>
          <nav
            aria-label="Browse"
            className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-5"
          >
            <Link
              href="/search"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "rounded-full text-white/75 hover:text-white",
              )}
            >
              <Search className="mr-2 size-4" aria-hidden="true" />
              Search titles
            </Link>
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "rounded-full text-white/75 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
