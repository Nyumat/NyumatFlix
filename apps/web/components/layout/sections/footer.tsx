"use client";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { getFooterLinks } from "@/lib/navigation";
import { Cannabis, Heart } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";

export const FooterSection = () => {
  const flags = useFeatureFlags();
  const footerLinks = getFooterLinks(flags.liveTvEnabled);
  return (
    <footer
      id="footer"
      className="relative z-10 mt-auto w-full border-t border-border/40 bg-card/35 backdrop-blur-xs"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="container mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-4">
        <div className="hidden sm:flex sm:items-center sm:justify-between lg:gap-3">
          <BrandLogo placement="footer" />

          <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end sm:gap-4 lg:gap-5">
            <nav aria-label="Explore" className="hidden sm:block">
              <ul
                className="flex flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-4 lg:gap-x-5"
                role="list"
              >
                {footerLinks.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="flex flex-row items-center gap-3 sm:mt-4 sm:flex-col sm:items-start sm:gap-2.5 sm:border-t sm:border-border/40 sm:pt-4 lg:mt-3 lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:pt-3">
          <div className="shrink-0 sm:hidden">
            <BrandLogo placement="footer" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Made with{" "}
              <Cannabis className="inline-block w-4 h-4 text-green-500 mb-1" />{" "}
              and <Heart className="inline-block w-4 h-4 text-red-500 mb-1" />{" "}
              for you and me.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground lg:max-w-xl lg:shrink-0 lg:text-right">
              Just another{" "}
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4 hover:text-primary"
              >
                {" "}
                TMDB{" "}
              </a>{" "}
              and{" "}
              <a
                href="https://anilist.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4 hover:text-primary"
              >
                {" "}
                AniList{" "}
              </a>{" "}
              wrapper.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
