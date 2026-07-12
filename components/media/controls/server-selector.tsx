"use client";

import {
  useServerStore,
  videoServers,
  scrapeServer,
  isScrapeServer,
  VIDSRC_MIRROR_APIS,
} from "@/lib/stores/server-store";
import { sortServersByAvailability } from "@/lib/scrape/source-overlay";
import {
  mergeScrapeProviderMenu,
  type ScrapeProviderMenuEntry,
} from "@/lib/scrape/scrape-provider-menu";
import {
  resolveScrapeMenuDotVariant,
  shouldDimScrapeMenuProvider,
} from "@/lib/scrape/scrape-provider-menu-status";
import type { ScrapeItem, ScrapeItemStatus } from "@/lib/scrape/types";
import {
  dualCapabilityEmbedProviderIds,
  embedOnlyProviderIds,
  TMDB_SCRAPE_PROVIDER_OPTIONS,
} from "@/lib/providers/registry";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { MediaItem } from "@/lib/domain/typings";
import type { ScrapePlayerStatus } from "@/hooks/use-scrape";
import { useFeatureFlagsOptional } from "@/components/providers/feature-flags-provider";
import {
  getPlaybackModePolicy,
  isAnimeScrapeProviderEnabled,
  isEmbedProviderEnabled,
  isTmdbScrapeProviderEnabled,
} from "@/lib/flags/site-flags";
import { ScrapeProviderMenuDot } from "@/components/media/controls/scrape-provider-menu-dot";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Server,
} from "lucide-react";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PulsatingButton } from "@/components/ui/pulsating-button";
import {
  hasSeenProxyModeHint,
  rememberProxyModeHintSeen,
} from "@/lib/playback/proxy-mode-hint-storage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ScrapeProviderOption = {
  providerId: string;
  name: string;
  group?: "anime" | "tmdb";
};

type PlaybackMenuMode = "direct" | "embed";

const DUAL_EMBED_PICKER_ID = "__dual_embed__";
const PROXY_HINT_VISIBLE_MS = 5000;
const PROXY_HINT_EXIT_MS = 300;

type ProxyHintPhase = "idle" | "active" | "exiting";

const EMBED_ONLY_IDS = new Set(embedOnlyProviderIds());
const DUAL_EMBED_IDS = new Set(dualCapabilityEmbedProviderIds());

interface ServerSelectorProps {
  media?: MediaItem;
  mediaType?: "tv" | "movie";
  className?: string;
  onServerSelect?: () => void;
  scrapeStatus?: ScrapePlayerStatus;
  activeScrapeProviderId?: string | null;
  activeScrapeProviderName?: string | null;
  scrapeItems?: ScrapeItem[];
  scrapeProviders?: ScrapeProviderOption[];
  onSelectScrapeProvider?: (providerId: string) => void;
  onFindNextSource?: () => void;
  canFindNextSource?: boolean;
}

function ScrapeProviderStatusIcon({
  status,
  isActive,
  scrapeStatus,
}: {
  status: ScrapeItemStatus | "idle";
  isActive: boolean;
  scrapeStatus: ScrapePlayerStatus;
}) {
  const variant = resolveScrapeMenuDotVariant({
    liveStatus: status,
    isActive,
    scrapeStatus,
  });

  return <ScrapeProviderMenuDot variant={variant} />;
}

function ProxyModeHintBubble() {
  return (
    <motion.div
      key="proxy-mode-hint"
      initial={{ opacity: 0, y: 6, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.94 }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 28,
        opacity: { duration: 0.24, ease: "easeInOut" },
      }}
      className="pointer-events-none absolute bottom-[calc(100%+0.35rem)] left-1/2 z-30 w-max max-w-38 -translate-x-1/2"
    >
      <motion.div
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="relative rounded-md bg-primary px-2 py-1 text-center text-[10px] font-semibold leading-tight text-primary-foreground shadow-md"
      >
        Use proxy for no ads
        <span
          aria-hidden
          className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-primary"
        />
      </motion.div>
    </motion.div>
  );
}

function ModeSwitcher({
  mode,
  onModeChange,
  showEmbed,
  showProxyHint,
  onProxyHintDismiss,
}: {
  mode: PlaybackMenuMode;
  onModeChange: (mode: PlaybackMenuMode) => void;
  showEmbed: boolean;
  showProxyHint?: boolean;
  onProxyHintDismiss?: () => void;
}) {
  const [hintPhase, setHintPhase] = React.useState<ProxyHintPhase>("idle");

  React.useEffect(() => {
    if (!showProxyHint) {
      setHintPhase("idle");
      return;
    }

    setHintPhase("active");
    const visibleTimer = window.setTimeout(() => {
      setHintPhase("exiting");
    }, PROXY_HINT_VISIBLE_MS);

    return () => window.clearTimeout(visibleTimer);
  }, [showProxyHint]);

  React.useEffect(() => {
    if (hintPhase !== "exiting") return;

    const exitTimer = window.setTimeout(() => {
      onProxyHintDismiss?.();
    }, PROXY_HINT_EXIT_MS);

    return () => window.clearTimeout(exitTimer);
  }, [hintPhase, onProxyHintDismiss]);

  const hintEffectsVisible = hintPhase === "active" || hintPhase === "exiting";
  const pulseActive = hintPhase === "active";

  const proxyButtonClassName = cn(
    "flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-bold transition",
    mode === "direct"
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
  );

  const handleProxySelect = () => {
    onModeChange("direct");
    onProxyHintDismiss?.();
  };

  return (
    <div
      className={cn(
        "p-2 transition-[padding] duration-300",
        hintEffectsVisible && "pt-8",
      )}
      onPointerDown={(event) => event.preventDefault()}
    >
      <div
        role="radiogroup"
        aria-label="Playback mode"
        className={cn(
          "grid gap-1 rounded-lg bg-muted/80 p-1",
          showEmbed ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        <div className="relative">
          <AnimatePresence>
            {hintPhase === "active" ? <ProxyModeHintBubble /> : null}
          </AnimatePresence>
          {hintEffectsVisible ? (
            <PulsatingButton
              type="button"
              role="radio"
              aria-checked={mode === "direct"}
              onClick={handleProxySelect}
              pulseActive={pulseActive}
              className={proxyButtonClassName}
            >
              Proxy
            </PulsatingButton>
          ) : (
            <button
              type="button"
              role="radio"
              aria-checked={mode === "direct"}
              onClick={handleProxySelect}
              className={proxyButtonClassName}
            >
              Proxy
            </button>
          )}
        </div>
        {showEmbed ? (
          <button
            type="button"
            role="radio"
            aria-checked={mode === "embed"}
            onClick={() => onModeChange("embed")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-bold transition",
              mode === "embed"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            Iframe
          </button>
        ) : null}
      </div>
      <p className="mt-2 px-0.5 text-[11px] leading-snug text-muted-foreground">
        {mode === "direct"
          ? "No ads, but volatile for obvious reasons."
          : "3rd parties that love popups."}
      </p>
    </div>
  );
}

export function ServerSelector({
  className,
  onServerSelect,
  scrapeStatus = "idle",
  activeScrapeProviderId,
  activeScrapeProviderName,
  scrapeItems = [],
  scrapeProviders = [],
  onSelectScrapeProvider,
  onFindNextSource,
  canFindNextSource = false,
}: ServerSelectorProps) {
  const [detailServerId, setDetailServerId] = React.useState<string>();
  const [menuMode, setMenuMode] = React.useState<PlaybackMenuMode>("direct");
  const [showProxyHint, setShowProxyHint] = React.useState(false);
  const {
    selectedServer,
    setSelectedServer,
    getServerOverride,
    animePreference,
    setAnimePreference,
    vidnestContentType,
    setVidnestContentType,
    vidsrcApi,
    setVidsrcApi,
    availableServerIds,
    unavailableServerIds,
  } = useServerStore();
  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const flags = useFeatureFlagsOptional();
  const playbackPolicy = flags ? getPlaybackModePolicy(flags) : "choice";
  const playbackModeLocked = flags?.locks.playbackMode ?? false;

  const isScrapeActive = isScrapeServer(selectedServer);
  const hasEnabledEmbedProviders =
    !flags ||
    Object.entries(flags.embedProviders).some(([, enabled]) => enabled);
  const showEmbedMode =
    !noAdsMode && playbackPolicy !== "proxy" && hasEnabledEmbedProviders;

  React.useEffect(() => {
    if (playbackPolicy === "proxy") {
      setMenuMode("direct");
      return;
    }
    if (playbackPolicy === "iframe") {
      setMenuMode("embed");
    }
  }, [playbackPolicy]);

  const directStreamProviders = React.useMemo<ScrapeProviderOption[]>(() => {
    const base =
      scrapeProviders.length > 0
        ? scrapeProviders
        : TMDB_SCRAPE_PROVIDER_OPTIONS;
    if (!flags) return base;
    return base.filter((provider) => {
      if ("group" in provider && provider.group === "anime") {
        return isAnimeScrapeProviderEnabled(flags, provider.providerId);
      }
      return isTmdbScrapeProviderEnabled(flags, provider.providerId);
    });
  }, [flags, scrapeProviders]);

  const sortedEmbedServers = React.useMemo(() => {
    const sorted = sortServersByAvailability(
      videoServers,
      availableServerIds,
      unavailableServerIds,
    );
    if (!flags) return sorted;
    return sorted.filter((server) => isEmbedProviderEnabled(flags, server.id));
  }, [availableServerIds, flags, unavailableServerIds]);

  const directStreamMenuItems = React.useMemo(
    () =>
      mergeScrapeProviderMenu(
        directStreamProviders,
        scrapeItems,
        activeScrapeProviderId,
      ),
    [activeScrapeProviderId, directStreamProviders, scrapeItems],
  );

  const embedOnlyServers = React.useMemo(
    () => sortedEmbedServers.filter((server) => EMBED_ONLY_IDS.has(server.id)),
    [sortedEmbedServers],
  );

  const dualEmbedServers = React.useMemo(
    () => sortedEmbedServers.filter((server) => DUAL_EMBED_IDS.has(server.id)),
    [sortedEmbedServers],
  );

  const isServerEnabled = (serverId: string): boolean => {
    if (unavailableServerIds.includes(serverId)) return false;
    const override = getServerOverride(serverId);
    if (!override) return true;
    return override.isAvailable;
  };

  const handleServerChange = (serverId: string) => {
    const server =
      serverId === scrapeServer.id
        ? scrapeServer
        : videoServers.find((s) => s.id === serverId);
    if (!server) return;
    setSelectedServer(server);
    onServerSelect?.();
  };

  const dismissProxyHint = React.useCallback(() => {
    setShowProxyHint((active) => {
      if (!active) return false;
      rememberProxyModeHintSeen();
      return false;
    });
  }, []);

  const handleModeChange = (mode: PlaybackMenuMode) => {
    setMenuMode(mode);
    if (mode === "direct") {
      dismissProxyHint();
      if (!isScrapeActive) {
        handleServerChange(scrapeServer.id);
      }
    }
  };

  const detailServer = detailServerId
    ? videoServers.find((server) => server.id === detailServerId)
    : undefined;

  const keepMenuOpen = (event: Event) => event.preventDefault();

  const triggerLabel = (() => {
    if (
      isScrapeActive &&
      scrapeStatus === "playing" &&
      activeScrapeProviderName
    ) {
      return activeScrapeProviderName;
    }

    if (isScrapeActive) {
      return "Proxy";
    }

    return selectedServer.name;
  })();

  const triggerModeHint = isScrapeActive ? "Proxy" : "Iframe";

  const serverHasOptions = (serverId: string) =>
    serverId === "vidnest" ||
    serverId === "videasy" ||
    serverId === "vidsrc-mirror";

  const renderEmbedServerItem = (
    server: (typeof videoServers)[number],
    options?: { isFirst?: boolean; isLast?: boolean },
  ) => {
    const hasOptions = serverHasOptions(server.id);
    const enabled = isServerEnabled(server.id);
    const isSelected = selectedServer.id === server.id && !isScrapeActive;

    return (
      <DropdownMenuItem
        key={server.id}
        onSelect={(event) => {
          if (!enabled) {
            event.preventDefault();
            return;
          }

          if (hasOptions) {
            event.preventDefault();
            setDetailServerId(server.id);
            return;
          }

          handleServerChange(server.id);
        }}
        className={cn(
          "flex cursor-pointer items-center justify-between rounded-none py-2",
          options?.isFirst && "rounded-t-md",
          options?.isLast && "rounded-b-md",
          isSelected && "bg-accent/60",
        )}
        disabled={!enabled}
      >
        <span className="font-semibold">{server.name}</span>
        {hasOptions ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : isSelected ? (
          <Check className="h-4 w-4 text-primary" />
        ) : null}
      </DropdownMenuItem>
    );
  };

  const renderDirectStreamPanel = () => {
    const animeProviders = directStreamMenuItems.filter(
      (provider) => provider.group !== "tmdb",
    );
    const tmdbProviders = directStreamMenuItems.filter(
      (provider) => provider.group === "tmdb",
    );
    const hasGroups =
      animeProviders.length > 0 &&
      tmdbProviders.length > 0 &&
      directStreamMenuItems.some((provider) => provider.group);

    const renderProviderItem = (provider: ScrapeProviderMenuEntry) => {
      const isActive =
        isScrapeActive &&
        activeScrapeProviderId === provider.providerId &&
        scrapeStatus === "playing";
      const dimProvider = shouldDimScrapeMenuProvider(provider.status);

      return (
        <DropdownMenuItem
          key={provider.providerId}
          onSelect={() => {
            if (!isScrapeActive) {
              handleServerChange(scrapeServer.id);
            }
            onSelectScrapeProvider?.(provider.providerId);
          }}
          className={cn(
            "flex cursor-pointer items-center justify-between rounded-none py-2",
            isActive && "font-semibold",
            dimProvider && !isActive && "text-muted-foreground",
          )}
          disabled={!onSelectScrapeProvider}
        >
          <span className="font-semibold">{provider.name}</span>
          <ScrapeProviderStatusIcon
            status={provider.status}
            isActive={isActive}
            scrapeStatus={scrapeStatus}
          />
        </DropdownMenuItem>
      );
    };

    return (
      <div className="px-1 pb-1">
        {hasGroups ? (
          <>
            <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Anime sources
            </DropdownMenuLabel>
            {animeProviders.map((provider) => renderProviderItem(provider))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              TMDB proxies
            </DropdownMenuLabel>
            {tmdbProviders.map((provider) => renderProviderItem(provider))}
          </>
        ) : (
          directStreamMenuItems.map((provider) => renderProviderItem(provider))
        )}
        {canFindNextSource && onFindNextSource ? (
          <DropdownMenuItem
            onSelect={onFindNextSource}
            className="mt-0.5 flex cursor-pointer items-center gap-2 rounded-none py-2 font-medium text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try next source</span>
          </DropdownMenuItem>
        ) : null}
      </div>
    );
  };

  const renderEmbedPanel = () => {
    const embedOnlyCount = embedOnlyServers.length;
    const hasMoreEmbedServers = dualEmbedServers.length > 0;

    return (
      <div className="px-1 pb-1">
        {embedOnlyServers.map((server, index) =>
          renderEmbedServerItem(server, {
            isFirst: index === 0,
            isLast: index === embedOnlyCount - 1 && !hasMoreEmbedServers,
          }),
        )}
        {dualEmbedServers.length > 0 ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setDetailServerId(DUAL_EMBED_PICKER_ID);
            }}
            className="flex cursor-pointer items-center justify-between rounded-b-md rounded-none py-2 text-muted-foreground"
          >
            <span className="font-medium">More embed servers</span>
            <ChevronRight className="h-4 w-4" />
          </DropdownMenuItem>
        ) : null}
      </div>
    );
  };

  const renderServerDetailPanel = (server: (typeof videoServers)[number]) => (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault();
          setDetailServerId(undefined);
        }}
        className="flex cursor-pointer items-center gap-2 py-2 text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => handleServerChange(server.id)}
        className="flex cursor-pointer items-center justify-between py-2"
        disabled={!isServerEnabled(server.id)}
      >
        <span className="font-semibold">Use {server.name}</span>
        {selectedServer.id === server.id && !isScrapeActive ? (
          <Check className="h-4 w-4 text-primary" />
        ) : null}
      </DropdownMenuItem>
      {server.id === "vidnest" && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Content
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={vidnestContentType}
            onValueChange={(value) =>
              setVidnestContentType(value as typeof vidnestContentType)
            }
          >
            <DropdownMenuRadioItem value="movie" onSelect={keepMenuOpen}>
              Movie
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="tv" onSelect={keepMenuOpen}>
              TV show
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="anime" onSelect={keepMenuOpen}>
              Anime
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="animepahe" onSelect={keepMenuOpen}>
              AnimePahe
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </>
      )}
      {server.id === "vidsrc-mirror" && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            API
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={vidsrcApi}
            onValueChange={(value) => setVidsrcApi(value as typeof vidsrcApi)}
          >
            {VIDSRC_MIRROR_APIS.map((api) => (
              <DropdownMenuRadioItem
                key={api.value}
                value={api.value}
                onSelect={keepMenuOpen}
              >
                {api.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </>
      )}
      {(server.id === "videasy" ||
        vidnestContentType === "anime" ||
        vidnestContentType === "animepahe") && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Anime audio
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={animePreference}
            onValueChange={(value) =>
              setAnimePreference(value as typeof animePreference)
            }
          >
            <DropdownMenuRadioItem value="sub" onSelect={keepMenuOpen}>
              Subbed anime
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dub" onSelect={keepMenuOpen}>
              Dubbed anime
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </>
      )}
    </>
  );

  const renderDualEmbedPicker = () => (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault();
          setDetailServerId(undefined);
        }}
        className="flex cursor-pointer items-center gap-2 py-2 text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Embed players
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Also as embed
      </DropdownMenuLabel>
      {dualEmbedServers.map((server, index) =>
        renderEmbedServerItem(server, {
          isFirst: index === 0,
          isLast: index === dualEmbedServers.length - 1,
        }),
      )}
    </>
  );

  const renderRootMenu = () => (
    <>
      {!playbackModeLocked ? (
        <ModeSwitcher
          mode={menuMode}
          onModeChange={handleModeChange}
          showEmbed={showEmbedMode}
          showProxyHint={showProxyHint}
          onProxyHintDismiss={dismissProxyHint}
        />
      ) : null}
      {!playbackModeLocked ? <DropdownMenuSeparator /> : null}
      <div className="max-h-[min(52vh,18rem)] overflow-y-auto">
        {menuMode === "direct" || !showEmbedMode
          ? renderDirectStreamPanel()
          : renderEmbedPanel()}
      </div>
    </>
  );

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          if (playbackPolicy === "proxy") {
            setMenuMode("direct");
          } else if (playbackPolicy === "iframe") {
            setMenuMode("embed");
          } else {
            setMenuMode(isScrapeActive ? "direct" : "embed");
          }
          if (!hasSeenProxyModeHint() && playbackPolicy === "choice") {
            setShowProxyHint(true);
          }
        }
        if (!open) {
          setDetailServerId(undefined);
          dismissProxyHint();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Choose playback mode and source"
          aria-label="Choose playback mode and source"
          className={cn(
            "flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 font-bold text-white shadow-lg backdrop-blur-md transition hover:border-white/40 hover:bg-white/20 hover:shadow-xl",
            className,
          )}
        >
          <Server className="h-4 w-4 shrink-0" />
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
              {triggerModeHint}
            </span>
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 max-h-[min(70vh,24rem)] overflow-y-auto p-0"
      >
        {detailServerId === DUAL_EMBED_PICKER_ID
          ? renderDualEmbedPicker()
          : detailServer
            ? renderServerDetailPanel(detailServer)
            : renderRootMenu()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
