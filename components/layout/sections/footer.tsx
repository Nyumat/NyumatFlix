import { GithubIcon } from "@/components/icons/github-icon";
import { Separator } from "@/components/ui/separator";
import { Cannabis, Globe, Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const FooterSection = () => {
  return (
    <footer
      id="footer"
      className="w-full bg-card/50 backdrop-blur-sm border-t border-border/50 mt-auto"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="flex items-center space-x-2 mb-4"
              aria-label="NyumatFlix homepage"
            >
              <Image
                src="/logo.svg"
                alt="NyumatFlix Logo"
                width={30}
                height={30}
                className="hover:scale-105 transition-transform duration-200"
              />
              <h3 className="text-xl font-bold text-secondary">NyumatFlix</h3>
            </Link>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              An open source aggregator which curates movies and TV shows online
              for everyone to enjoy freely.
            </p>

            {/* Social Media Links */}
            <div
              className="flex space-x-4"
              role="list"
              aria-label="Social media links"
            >
              <Link
                href="https://github.com/Nyumat/NyumatFlix"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-muted hover:bg-accent border border-border transition-all duration-200 group"
                aria-label="NyumatFlix GitHub repository"
                title="NyumatFlix GitHub repository"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubIcon className="w-5 h-5 fill-foreground group-hover:scale-110 transition-transform duration-200" />
              </Link>
              <Link
                href="https://nyuma.dev"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-muted hover:bg-accent border border-border transition-all duration-200 group"
                aria-label="Creator's website"
                title="Creator's website"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="w-4 h-4 fill-white dark:fill-black group-hover:scale-110 transition-transform duration-200" />
              </Link>
            </div>
          </div>

          {/* Product Links */}
          <nav className="col-span-1" aria-labelledby="product-heading">
            <h4
              id="product-heading"
              className="font-semibold text-foreground mb-4"
            >
              Explore
            </h4>
            <ul className="space-y-3" role="list">
              <li>
                <Link
                  href="/home"
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
                  href="/search"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  Search
                </Link>
              </li>
            </ul>
          </nav>

          {/* Legal Links */}
          <nav className="col-span-1" aria-labelledby="legal-heading">
            <h4
              id="legal-heading"
              className="font-semibold text-foreground mb-4"
            >
              Legal
            </h4>
            <ul className="space-y-3" role="list">
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/cookie-policy"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/dmca"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  DMCA
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <Separator className="my-8" />

        {/* Bottom Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} NyumatFlix. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Made with{" "}
            <Cannabis className="inline-block w-4 h-4 text-green-500 mb-1" />{" "}
            and <Heart className="inline-block w-4 h-4 text-red-500 mb-1" /> for
            movie, TV show, and anime enthusiasts.
          </p>
        </div>
      </div>
    </footer>
  );
};
