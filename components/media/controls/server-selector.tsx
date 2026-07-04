"use client";

import {
  useServerStore,
  videoServers,
  VIDSRC_MIRROR_APIS,
} from "@/lib/stores/server-store";
import { MediaItem } from "@/lib/domain/typings";
import { Check, ChevronLeft, ChevronRight, Server } from "lucide-react";
import * as React from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ServerSelectorProps {
  media?: MediaItem;
  mediaType?: "tv" | "movie";
  className?: string;
  onServerSelect?: () => void;
}

export function ServerSelector({
  className,
  onServerSelect,
}: ServerSelectorProps) {
  const [detailServerId, setDetailServerId] = React.useState<string>();
  const {
    selectedServer,
    setSelectedServer,
    getServerOverride,
    unavailableServerIds,
    animePreference,
    setAnimePreference,
    vidnestContentType,
    setVidnestContentType,
    vidsrcApi,
    setVidsrcApi,
  } = useServerStore();

  const isServerEnabled = (serverId: string): boolean => {
    if (unavailableServerIds.includes(serverId)) return false;
    const override = getServerOverride(serverId);
    if (!override) return true;
    return override.isAvailable;
  };

  const handleServerChange = (serverId: string) => {
    const server = videoServers.find((s) => s.id === serverId);
    if (!server) return;
    setSelectedServer(server);
    onServerSelect?.();
  };

  const detailServer = detailServerId
    ? videoServers.find((server) => server.id === detailServerId)
    : undefined;

  const renderServerLabel = (server: (typeof videoServers)[number]) => (
    <div className="flex items-center">
      <span className="font-medium">{server.name}</span>
    </div>
  );

  const keepMenuOpen = (event: Event) => event.preventDefault();

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) setDetailServerId(undefined);
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className={`backdrop-blur-md bg-white/10 border border-white/30 text-white py-2 px-4 rounded-full font-bold hover:bg-white/20 hover:border-white/40 hover:shadow-xl transition flex items-center shadow-lg gap-2 ${className}`}
              >
                <Server className="h-4 w-4" />
                {selectedServer.name}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Select a server to stream from</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-44">
          {detailServer ? (
            <>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setDetailServerId(undefined);
                }}
                className="flex cursor-pointer items-center gap-2 text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                Servers
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => handleServerChange(detailServer.id)}
                className="flex cursor-pointer items-center justify-between"
                disabled={!isServerEnabled(detailServer.id)}
              >
                <span className="font-medium">Use {detailServer.name}</span>
                {selectedServer.id === detailServer.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
              {detailServer.id === "vidnest" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                    Content
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={vidnestContentType}
                    onValueChange={(value) =>
                      setVidnestContentType(value as typeof vidnestContentType)
                    }
                  >
                    <DropdownMenuRadioItem
                      value="movie"
                      onSelect={keepMenuOpen}
                    >
                      Movie
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="tv" onSelect={keepMenuOpen}>
                      TV show
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="anime"
                      onSelect={keepMenuOpen}
                    >
                      Anime
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="animepahe"
                      onSelect={keepMenuOpen}
                    >
                      AnimePahe
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </>
              )}
              {detailServer.id === "vidsrc-mirror" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                    API
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={vidsrcApi}
                    onValueChange={(value) =>
                      setVidsrcApi(value as typeof vidsrcApi)
                    }
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
              {(detailServer.id === "videasy" ||
                vidnestContentType === "anime" ||
                vidnestContentType === "animepahe") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                    Anime Audio
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
          ) : (
            [...videoServers]
              .filter((server) => isServerEnabled(server.id))
              .map((server) => {
                const hasOptions =
                  server.id === "vidnest" ||
                  server.id === "videasy" ||
                  server.id === "vidsrc-mirror";

                return (
                  <DropdownMenuItem
                    key={server.id}
                    onSelect={(event) => {
                      if (hasOptions) {
                        event.preventDefault();
                        setDetailServerId(server.id);
                        return;
                      }

                      handleServerChange(server.id);
                    }}
                    className="flex cursor-pointer items-center justify-between"
                  >
                    {renderServerLabel(server)}
                    {hasOptions ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : selectedServer.id === server.id ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
