import { DiscordIcon } from "@/components/icons/discord-icon";
import { GithubIcon } from "@/components/icons/github-icon";
import { XIcon } from "@/components/icons/x-icon";
import { Separator } from "@/components/ui/separator";
import { ChevronsDownIcon } from "lucide-react";
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="flex items-center space-x-2 mb-4"
              aria-label="NyumatFlix homepage"
            >
              <ChevronsDownIcon className="w-8 h-8 bg-gradient-to-tr from-primary via-primary/70 to-primary rounded-lg border border-secondary p-1" />
              <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                NyumatFlix
              </h3>
            </Link>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              Your ultimate destination for movies and TV shows. Discover,
              explore, and enjoy entertainment like never before.
            </p>

            {/* Social Media Links */}
            <div
              className="flex space-x-4"
              role="list"
              aria-label="Social media links"
            >
              <Link
                href="https://github.com/Nyumat/NyumatFlix"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#24292e] hover:bg-[#1c2128] border border-[#30363d] transition-all duration-200 group"
                aria-label="Visit our GitHub repository"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubIcon className="w-5 h-5 fill-white group-hover:scale-110 transition-transform duration-200" />
              </Link>
              <Link
                href="#"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] border border-[#4752C4] transition-all duration-200 group"
                aria-label="Join our Discord server"
                target="_blank"
                rel="noopener noreferrer"
              >
                <DiscordIcon className="w-5 h-5 fill-white group-hover:scale-110 transition-transform duration-200" />
              </Link>
              <Link
                href="#"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-black hover:bg-gray-800 border border-gray-700 transition-all duration-200 group"
                aria-label="Follow us on X (Twitter)"
                target="_blank"
                rel="noopener noreferrer"
              >
                <XIcon className="w-4 h-4 fill-white group-hover:scale-110 transition-transform duration-200" />
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
                  href="/search"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  Search
                </Link>
              </li>
            </ul>
          </nav>

          {/* Community Links */}
          <nav className="col-span-1" aria-labelledby="community-heading">
            <h4
              id="community-heading"
              className="font-semibold text-foreground mb-4"
            >
              Community
            </h4>
            <ul className="space-y-3" role="list">
              <li>
                <Link
                  href="https://github.com/Nyumat/NyumatFlix"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Discord Server
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  Feedback
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  Support
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
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link
                  href="#"
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
            Made with ❤️ for movie and TV show enthusiasts
          </p>
        </div>
      </div>
    </footer>
  );
};
