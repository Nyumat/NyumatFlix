"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput,
  CommandSeparator,
} from "@/components/ui/command";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import {
  Bookmark,
  BookOpen,
  Clapperboard,
  Compass,
  Home,
  ImageIcon,
  LogIn,
  LogOut,
  Radio,
  Settings,
  ShieldOff,
  TrendingUp,
  Tv,
  Users,
  Volume2,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface NavCommandItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BROWSE_ITEMS: NavCommandItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Movies", href: "/movies", icon: Clapperboard },
  { label: "TV Shows", href: "/tvshows", icon: Tv },
  { label: "Anime", href: "/anime", icon: BookOpen },
  { label: "People", href: "/people", icon: Users },
  { label: "Trending", href: "/trending", icon: TrendingUp },
];

const LIVE_TV_ITEM: NavCommandItem = {
  label: "Live TV",
  href: "/live",
  icon: Radio,
};

const DISCOVER_ITEMS: NavCommandItem[] = [
  { label: "Popular Movies", href: "/movies/popular", icon: Compass },
  { label: "Top Rated Movies", href: "/movies/top-rated", icon: Compass },
  { label: "Now Playing", href: "/movies/now-playing", icon: Compass },
  { label: "Upcoming Movies", href: "/movies/upcoming", icon: Compass },
  { label: "Popular TV", href: "/tvshows/popular", icon: Compass },
  { label: "Top Rated TV", href: "/tvshows/top-rated", icon: Compass },
  { label: "Airing Today", href: "/tvshows/airing-today", icon: Compass },
  { label: "On The Air", href: "/tvshows/on-the-air", icon: Compass },
];

const ACCOUNT_ITEMS: NavCommandItem[] = [
  { label: "Watchlist", href: "/watchlist", icon: Bookmark },
  { label: "Settings", href: "/settings", icon: Settings },
];

const commandGroupClassName = "p-0";
const commandItemClassName = "w-full rounded-none px-4";

export function GlobalCommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const flags = useFeatureFlags();

  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const disableHeroTrailers = useAppSettingsStore(
    (state) => state.disableHeroTrailers,
  );
  const disableHoverSound = useAppSettingsStore(
    (state) => state.disableHoverSound,
  );
  const setNoAdsMode = useAppSettingsStore((state) => state.setNoAdsMode);
  const setDisableHeroTrailers = useAppSettingsStore(
    (state) => state.setDisableHeroTrailers,
  );
  const setDisableHoverSound = useAppSettingsStore(
    (state) => state.setDisableHoverSound,
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "p" ||
        (!event.metaKey && !event.ctrlKey)
      ) {
        return;
      }

      event.preventDefault();
      setOpen((prev) => !prev);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const runCommand = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  const hideAll = flags.locks.browseSettings;
  const hideNoAds = hideAll || flags.locks.playbackMode;
  const hideHero = hideAll || flags.locks.heroTrailers;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <DialogTitle className="sr-only">Command Menu</DialogTitle>
      <DialogDescription className="sr-only">
        Search for pages and actions across NyumatFlix
      </DialogDescription>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup className={commandGroupClassName} heading="Browse">
          {BROWSE_ITEMS.map(({ label, href, icon: Icon }) => (
            <CommandItem
              className={commandItemClassName}
              key={href}
              value={label}
              onSelect={() => runCommand(() => router.push(href))}
            >
              <Icon className="mr-2 h-4 w-4" />
              <span>{label}</span>
            </CommandItem>
          ))}
          {flags.liveTvEnabled ? (
            <CommandItem
              className={commandItemClassName}
              key={LIVE_TV_ITEM.href}
              value={LIVE_TV_ITEM.label}
              onSelect={() => runCommand(() => router.push(LIVE_TV_ITEM.href))}
            >
              <LIVE_TV_ITEM.icon className="mr-2 h-4 w-4" />
              <span>{LIVE_TV_ITEM.label}</span>
            </CommandItem>
          ) : null}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup className={commandGroupClassName} heading="Discover">
          {DISCOVER_ITEMS.map(({ label, href, icon: Icon }) => (
            <CommandItem
              className={commandItemClassName}
              key={href}
              value={label}
              onSelect={() => runCommand(() => router.push(href))}
            >
              <Icon className="mr-2 h-4 w-4" />
              <span>{label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup className={commandGroupClassName} heading="Account">
          {ACCOUNT_ITEMS.map(({ label, href, icon: Icon }) => (
            <CommandItem
              className={commandItemClassName}
              key={href}
              value={label}
              onSelect={() => runCommand(() => router.push(href))}
            >
              <Icon className="mr-2 h-4 w-4" />
              <span>{label}</span>
            </CommandItem>
          ))}
          {session ? (
            <CommandItem
              className={commandItemClassName}
              value="Sign out"
              onSelect={() =>
                runCommand(() => void signOut({ callbackUrl: "/" }))
              }
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </CommandItem>
          ) : (
            <CommandItem
              className={commandItemClassName}
              value="Sign in"
              onSelect={() => runCommand(() => router.push("/login"))}
            >
              <LogIn className="mr-2 h-4 w-4" />
              <span>Sign in</span>
            </CommandItem>
          )}
        </CommandGroup>

        {!hideNoAds || !hideHero ? (
          <>
            <CommandSeparator />
            <CommandGroup
              className={commandGroupClassName}
              heading="Preferences"
            >
              {!hideNoAds ? (
                <CommandItem
                  className={commandItemClassName}
                  value="Toggle no ads mode"
                  onSelect={() => setNoAdsMode(!noAdsMode)}
                >
                  <ShieldOff className="mr-2 h-4 w-4" />
                  <span>
                    {noAdsMode ? "Turn off No ads mode" : "Turn on No ads mode"}
                  </span>
                </CommandItem>
              ) : null}
              {!hideHero ? (
                <CommandItem
                  className={commandItemClassName}
                  value="Toggle static hero"
                  onSelect={() => setDisableHeroTrailers(!disableHeroTrailers)}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  <span>
                    {disableHeroTrailers
                      ? "Turn off Static hero"
                      : "Turn on Static hero"}
                  </span>
                </CommandItem>
              ) : null}
              <CommandItem
                className={commandItemClassName}
                value="Toggle card hover sounds"
                onSelect={() => setDisableHoverSound(!disableHoverSound)}
              >
                <Volume2 className="mr-2 h-4 w-4" />
                <span>
                  {disableHoverSound
                    ? "Turn on Card hover sounds"
                    : "Turn off Card hover sounds"}
                </span>
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
