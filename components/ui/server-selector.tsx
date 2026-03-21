"use client";

import { useServerStore, videoServers } from "@/lib/stores/server-store";
import { MediaItem } from "@/utils/typings";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, Server, Wifi, WifiOff } from "lucide-react";
import { ContentTypeToggle } from "./content-type-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { SubDubToggle } from "./sub-dub-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

interface ServerSelectorProps {
  media?: MediaItem;
  mediaType?: "tv" | "movie";
  className?: string;
}

export function ServerSelector({
  media,
  mediaType,
  className,
}: ServerSelectorProps) {
  const {
    selectedServer,
    setSelectedServer,
    getServerOverride,
    animePreference,
    setAnimePreference,
    vidnestContentType,
    setVidnestContentType,
  } = useServerStore();

  const isServerEnabled = (serverId: string): boolean => {
    const override = getServerOverride(serverId);
    if (!override) return true;
    return override.isAvailable;
  };

  const getAvailabilityIcon = (serverId: string) => {
    const enabled = isServerEnabled(serverId);
    return enabled ? (
      <Wifi className="h-4 w-4 text-green-500" />
    ) : (
      <WifiOff className="h-4 w-4 text-red-500" />
    );
  };

  const handleServerChange = (serverId: string) => {
    const server = videoServers.find((s) => s.id === serverId);
    if (!server) return;
    setSelectedServer(server);
  };

  const currentServerEnabled = isServerEnabled(selectedServer.id);

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className={`backdrop-blur-md bg-white/10 border border-white/30 text-white py-2 px-4 rounded-full font-bold hover:bg-white/20 hover:border-white/40 hover:shadow-xl transition flex items-center shadow-lg gap-2 ${className}`}
              >
                <Server className="h-4 w-4" />
                {selectedServer.name}
                {currentServerEnabled ? (
                  <Wifi className="h-4 w-4 text-green-400" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-400" />
                )}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Select a server to stream from</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          {videoServers
            .sort((a, b) => {
              const aEnabled = isServerEnabled(a.id);
              const bEnabled = isServerEnabled(b.id);
              if (aEnabled !== bEnabled) return bEnabled ? 1 : -1;
              return 0;
            })
            .map((server) => {
              const enabled = isServerEnabled(server.id);
              const isDisabled = !enabled;
              const serverOverride = getServerOverride(server.id);

              const isVidnestServer = server.id === "vidnest";
              const isVideasyServer = server.id === "videasy";

              if (isVidnestServer || isVideasyServer) {
                return (
                  <DropdownMenuSub key={server.id}>
                    <DropdownMenuSubTrigger
                      onClick={() =>
                        !isDisabled && handleServerChange(server.id)
                      }
                      className={`flex items-center justify-between cursor-pointer ${
                        isDisabled ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      disabled={isDisabled}
                      title={
                        serverOverride && !serverOverride.isAvailable
                          ? serverOverride.reason || "Server disabled"
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{server.name}</span>
                        {getAvailabilityIcon(server.id)}
                      </div>
                      {selectedServer.id === server.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      {...({
                        side: "bottom",
                        align: "start",
                        sideOffset: 8,
                        alignOffset: -4,
                        collisionPadding: 16,
                      } as React.ComponentPropsWithoutRef<
                        typeof DropdownMenuPrimitive.SubContent
                      >)}
                      className="w-auto p-3 min-w-[200px]"
                    >
                      <div className="flex flex-col gap-3">
                        {isVidnestServer && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground px-1 uppercase tracking-wide">
                              Content Type
                            </span>
                            <ContentTypeToggle
                              value={vidnestContentType}
                              onValueChange={setVidnestContentType}
                            />
                          </div>
                        )}
                        {(isVideasyServer ||
                          vidnestContentType === "anime" ||
                          vidnestContentType === "animepahe") && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground px-1 uppercase tracking-wide">
                              Audio
                            </span>
                            <SubDubToggle
                              value={animePreference}
                              onValueChange={setAnimePreference}
                              aria-label="Choose subtitles or dubbed audio"
                            />
                          </div>
                        )}
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              }

              return (
                <DropdownMenuItem
                  key={server.id}
                  onClick={() => !isDisabled && handleServerChange(server.id)}
                  className={`flex items-center justify-between cursor-pointer ${
                    isDisabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  disabled={isDisabled}
                  title={
                    serverOverride && !serverOverride.isAvailable
                      ? serverOverride.reason || "Server disabled"
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{server.name}</span>
                    {getAvailabilityIcon(server.id)}
                  </div>
                  {selectedServer.id === server.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              );
            })}
          {media && (
            <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span>Enabled</span>
                </div>
                <div className="flex items-center gap-1">
                  <WifiOff className="h-3 w-3 text-red-500" />
                  <span>Disabled</span>
                </div>
              </div>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
