import { GithubIcon } from "@/components/icons/github-icon";
import { Cannabis, Globe, Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const FooterSection = () => {
  return (
    <footer
      id="footer"
      className="relative z-10 mt-auto w-full border-t border-border/40 bg-card/35 backdrop-blur-xs"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center md:justify-end">
            <nav aria-label="Explore" className="hidden lg:block">
              <ul className="flex flex-wrap gap-x-5 gap-y-2" role="list">
                <li>
                  <Link
                    href="/"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    href="/movies"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    Movies
                  </Link>
                </li>
                <li>
                  <Link
                    href="/tvshows"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    TV Shows
                  </Link>
                </li>
                <li>
                  <Link
                    href="/anime"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    Anime
                  </Link>
                </li>
                <li>
                  <Link
                    href="/search"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    Search
                  </Link>
                </li>
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

        <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">
            Made with{" "}
            <Cannabis className="inline-block w-4 h-4 text-green-500 mb-1" />{" "}
            and <Heart className="inline-block w-4 h-4 text-red-500 mb-1" /> for
            you and me.
          </p>
          <p className="ml-auto max-w-xl self-end text-right text-xs text-muted-foreground">
            Metadata from{" "}
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              {" "}
              TMDb{" "}
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
            . No media hosted.
          </p>
        </div>
      </div>
    </footer>
  );
};
