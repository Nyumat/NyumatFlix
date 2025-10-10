"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const copycatSites: string[] = [
  "flixwatch.life",
  "freecinehub.site",
  "freestream.site",
  "fsiblog3.site",
  "funmovies.site",
  "moviestreamnow.site",
  "popcornflixpro.site",
  "streamflicksfree.site",
  "watchflixonline.site",
  "watchfreeflix.site",
];

export const CopycatWarning = () => {
  const handleCopyClick = (site: string) => {
    navigator.clipboard.writeText(site).catch(() => {
      // silently handle clipboard errors
    });
  };

  return (
    <div className="bg-gradient-to-r from-red-900/20 via-red-800/15 to-red-900/20 backdrop-blur-sm border-b border-red-500/20 text-white text-center py-2">
      <p className="text-sm font-semibold drop-shadow-md">
        Warning: <span className="text-red-600">Beware</span> of{" "}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="link"
              className="text-white underline hover:text-yellow-300 p-0 h-auto font-semibold text-sm drop-shadow-md transition-colors duration-200"
              aria-label="View list of copycat sites"
            >
              fake sites & copycats!
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="center">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Known Copycat Sites</h3>
              <div className="space-y-1">
                {copycatSites.map((site) => (
                  <button
                    key={site}
                    onClick={() => handleCopyClick(site)}
                    className="block w-full text-left text-sm font-mono hover:bg-muted p-1 rounded transition-colors"
                    aria-label={`Copy ${site} to clipboard`}
                  >
                    {site}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>{" "}
        The ONLY official site is{" "}
        <a
          href="https://nyumatflix.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-yellow-300 transition-colors duration-200 drop-shadow-md"
          aria-label="Visit the official NyumatFlix website"
        >
          nyumatflix.com
        </a>{" "}
      </p>
    </div>
  );
};

export default CopycatWarning;
