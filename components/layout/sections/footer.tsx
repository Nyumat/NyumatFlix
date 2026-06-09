import { GithubIcon } from "@/components/icons/github-icon";
import { Cannabis, Globe, Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/movies", label: "Movies" },
  { href: "/tvshows", label: "TV Shows" },
  { href: "/anime", label: "Anime" },
  { href: "/live", label: "Live TV" },
  { href: "/search", label: "Search" },
] as const;

export const FooterSection = () => {
  return (
    <footer
      id="footer"
      className="relative z-10 mt-auto w-full border-t border-border/40 bg-card/35 backdrop-blur-xs"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="container mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center space-x-2"
            aria-label="NyumatFlix homepage"
          >
            <Image
              src="/logo.svg"
              alt="NyumatFlix Logo"
              width={30}
              height={30}
              className="hover:scale-105 transition-transform duration-200"
            />
            <h3 className="text-base font-bold text-secondary">NyumatFlix</h3>
          </Link>

          <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end sm:gap-4 lg:gap-5">
            <nav aria-label="Explore" className="hidden sm:block">
              <ul
                className="flex flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-4 lg:gap-x-5"
                role="list"
              >
                {FOOTER_LINKS.map(({ href, label }) => (
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

            <div
              className="flex space-x-3"
              role="list"
              aria-label="Social media links"
            >
              <Link
                href="https://github.com/Nyumat/NyumatFlix"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted transition-all duration-200 hover:bg-accent group"
                aria-label="NyumatFlix GitHub repository"
                title="NyumatFlix GitHub repository"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubIcon className="h-5 w-5 fill-foreground transition-transform duration-200 group-hover:scale-110" />
              </Link>
              <Link
                href="https://nyuma.dev"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted transition-all duration-200 hover:bg-accent group"
                aria-label="Creator's website"
                title="Creator's website"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="h-4 w-4 fill-white transition-transform duration-200 group-hover:scale-110 dark:fill-black" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-start gap-2 border-t border-border/40 pt-4 sm:gap-2.5 lg:mt-3 lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:pt-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Made with{" "}
            <Cannabis className="inline-block w-4 h-4 text-green-500 mb-1" />{" "}
            and <Heart className="inline-block w-4 h-4 text-red-500 mb-1" /> for
            you and me.
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
    </footer>
  );
};
