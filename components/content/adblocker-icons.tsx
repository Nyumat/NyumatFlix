"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/legacy/image";
import Link from "next/link";

export type AdblockerIconsProps = {
  className?: string;
  linkTextClassName?: string;
};

export const AdblockerIcons = ({
  className,
  linkTextClassName,
}: AdblockerIconsProps) => {
  return (
    <div
      className={
        className ? className : "flex flex-col items-center gap-3 sm:gap-4"
      }
    >
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
            className={
              linkTextClassName
                ? linkTextClassName
                : "text-xs text-muted-foreground hover:text-primary transition-colors"
            }
          >
            Can&apos;t download on Chrome?
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top">
          How to enable uBlock Origin again
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default AdblockerIcons;
