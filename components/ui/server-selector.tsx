"use client";

import { useServerStore, videoServers } from "@/lib/stores/server-store";
import { MediaItem, isMovie, isTVShow } from "@/utils/typings";
import { Check, Server, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

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
    getAvailableServer,
    serverOverrides,
    getServerOverride,
    isServerOverridden,
  } = useServerStore();
  const [availabilityData, setAvailabilityData] = useState<{
    [serverId: string]: {
      movies: number[];
      tv: number[];
      isLoading: boolean;
    };
  }>({});
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const getMediaType = (): "movie" | "tv" => {
    if (mediaType) {
      return mediaType;
    }

    if (media) {
      if (isMovie(media)) {
        return "movie";
      } else if (isTVShow(media)) {
        return "tv";
      }
    }

    if (typeof window !== "undefined") {
      if (window.location.pathname.includes("/tvshows/")) {
        return "tv";
      } else if (window.location.pathname.includes("/movies/")) {
        return "movie";
      }
    }

    return "movie";
  };

  useEffect(() => {
    const fetchAvailabilityForAllServers = async () => {
      if (!media) return;

      const detectedMediaType = getMediaType();

      const initialData: typeof availabilityData = {};
      videoServers.forEach((server) => {
        const serverOverride = getServerOverride(server.id);

        if (serverOverride && !serverOverride.isAvailable) {
          initialData[server.id] = {
            movies: [],
            tv: [],
            isLoading: false,
          };
        } else {
          initialData[server.id] = {
            movies: [],
            tv: [],
            isLoading:
              server.checkAvailability || server.checkIndividualAvailability
                ? true
                : false,
          };
        }
      });
      setAvailabilityData(initialData);

      const fetchPromises = videoServers.map(async (server) => {
        const serverOverride = getServerOverride(server.id);

        if (serverOverride && !serverOverride.isAvailable) {
          return;
        }

        if (server.checkAvailability) {
          try {
            const [movies, tv] = await Promise.all([
              server.checkAvailability("movie"),
              server.checkAvailability("tv"),
            ]);

            setAvailabilityData((prev) => ({
              ...prev,
              [server.id]: {
                movies: Array.isArray(movies) ? movies : [],
                tv: Array.isArray(tv) ? tv : [],
                isLoading: false,
              },
            }));
          } catch (error) {
            console.error(
              `Error fetching availability for ${server.name}:`,
              error,
            );
            setAvailabilityData((prev) => ({
              ...prev,
              [server.id]: {
                movies: [],
                tv: [],
                isLoading: false,
              },
            }));
          }
        } else if (server.checkIndividualAvailability) {
          // I've set up individual availability checking for servers like filmku and embed.su.
          try {
            const isAvailable = await server.checkIndividualAvailability(
              media.id,
              detectedMediaType,
            );

            setAvailabilityData((prev) => ({
              ...prev,
              [server.id]: {
                movies:
                  detectedMediaType === "movie" && isAvailable
                    ? [media.id]
                    : [],
                tv: detectedMediaType === "tv" && isAvailable ? [media.id] : [],
                isLoading: false,
              },
            }));
          } catch (error) {
            console.error(
              `Error checking individual availability for ${server.name}:`,
              error,
            );
            setAvailabilityData((prev) => ({
              ...prev,
              [server.id]: {
                movies: [],
                tv: [],
                isLoading: false,
              },
            }));
          }
        } else {
          setAvailabilityData((prev) => ({
            ...prev,
            [server.id]: {
              movies: detectedMediaType === "movie" ? [media.id] : [],
              tv: detectedMediaType === "tv" ? [media.id] : [],
              isLoading: false,
            },
          }));
        }
      });

      await Promise.all(fetchPromises);
    };

    fetchAvailabilityForAllServers();
    setHasAutoSelected(false);
  }, [media, mediaType, serverOverrides, getServerOverride]);

  useEffect(() => {
    if (!media || hasAutoSelected) return;

    const detectedMediaType = getMediaType();

    const allServersLoaded = videoServers.every((server) => {
      const serverData = availabilityData[server.id];
      return serverData && !serverData.isLoading;
    });

    if (allServersLoaded) {
      const availableServer = getAvailableServer(
        media.id,
        detectedMediaType,
        availabilityData,
      );

      const currentServerOverride = getServerOverride(selectedServer.id);
      const isCurrentManuallyUnavailable =
        currentServerOverride && !currentServerOverride.isAvailable;

      const currentServerData = availabilityData[selectedServer.id];
      const isCurrentAvailable =
        !isCurrentManuallyUnavailable &&
        currentServerData &&
        (currentServerData[detectedMediaType]?.includes(media.id) ||
          (!selectedServer.checkAvailability &&
            !selectedServer.checkIndividualAvailability));

      if (!isCurrentAvailable && availableServer.id !== selectedServer.id) {
        setSelectedServer(availableServer);
      }

      setHasAutoSelected(true);
    }
  }, [
    media,
    mediaType,
    availabilityData,
    hasAutoSelected,
    selectedServer,
    setSelectedServer,
    getAvailableServer,
    getServerOverride,
  ]);

  const handleServerChange = (serverId: string) => {
    const server = videoServers.find((s) => s.id === serverId);
    if (!server) return;
    setSelectedServer(server);
  };

  const isContentAvailable = (serverId: string): boolean | null => {
    if (!media) return null;

    const server = videoServers.find((s) => s.id === serverId);
    if (!server) return null;

    const serverOverride = getServerOverride(serverId);
    if (serverOverride) {
      return serverOverride.isAvailable;
    }

    if (!server.checkAvailability && !server.checkIndividualAvailability) {
      return true;
    }

    const serverData = availabilityData[serverId];
    if (!serverData || serverData.isLoading) return null;

    const detectedMediaType = getMediaType();
    const contentArray = serverData[detectedMediaType];

    if (!contentArray || !Array.isArray(contentArray)) return null;

    const isAvailable = contentArray.includes(media.id);

    return isAvailable;
  };

  const isCheckingAvailability = (serverId: string): boolean => {
    if (isServerOverridden(serverId)) {
      return false;
    }

    const serverData = availabilityData[serverId];
    return serverData?.isLoading || false;
  };

  const getAvailabilityIcon = (serverId: string) => {
    if (!media) return null;

    const server = videoServers.find((s) => s.id === serverId);
    if (!server) return null;

    if (isCheckingAvailability(serverId)) {
      return <Wifi className="h-4 w-4 animate-pulse text-yellow-500" />;
    }

    const available = isContentAvailable(serverId);
    if (available === null) return null;

    return available ? (
      <Wifi className="h-4 w-4 text-green-500" />
    ) : (
      <WifiOff className="h-4 w-4 text-red-500" />
    );
  };

  const getCurrentServerAvailability = () => {
    if (!media) return null;
    return isContentAvailable(selectedServer.id);
  };

  const currentServerAvailability = getCurrentServerAvailability();
  const isCurrentServerLoading = isCheckingAvailability(selectedServer.id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`backdrop-blur-md bg-white/10 border border-white/30 text-white py-3 px-6 rounded-full font-bold hover:bg-white/20 hover:border-white/40 hover:shadow-xl transition flex items-center shadow-lg gap-2 ${className}`}
        >
          <Server className="h-4 w-4" />
          {selectedServer.name}
          {isCurrentServerLoading ? (
            <Wifi className="h-4 w-4 animate-pulse text-yellow-300" />
          ) : currentServerAvailability ? (
            <Wifi className="h-4 w-4 text-green-400" />
          ) : currentServerAvailability === false ? (
            <WifiOff className="h-4 w-4 text-red-400" />
          ) : (
            <Wifi className="h-4 w-4 text-gray-300" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {videoServers
          .sort((a, b) => {
            const aAvailable = isContentAvailable(a.id);
            const bAvailable = isContentAvailable(b.id);

            // We should prioritize available servers.
            if (aAvailable !== bAvailable) {
              return bAvailable ? 1 : -1;
            }

            return 0;
          })
          .map((server) => {
            const available = isContentAvailable(server.id);
            const isLoading = isCheckingAvailability(server.id);
            const isDisabled = available === false;
            const serverOverride = getServerOverride(server.id);

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
                    ? serverOverride.reason || "Server unavailable"
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{server.name}</span>
                  {getAvailabilityIcon(server.id)}
                </div>
                <div className="flex items-center gap-2">
                  {isLoading && (
                    <span className="text-xs text-muted-foreground">
                      Checking...
                    </span>
                  )}
                  {selectedServer.id === server.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        {media && (
          <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Wifi className="h-3 w-3 text-green-500" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1">
                <WifiOff className="h-3 w-3 text-red-500" />
                <span>Not Available</span>
              </div>
              <div className="flex items-center gap-1">
                <Wifi className="h-3 w-3 text-yellow-500" />
                <span>Checking...</span>
              </div>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
