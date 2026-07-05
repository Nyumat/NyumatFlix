/**
 * Compatibility facade — composes playback-mode and embed-server stores.
 * Prefer importing from the focused stores directly in new code.
 */

import { useEmbedServerStore } from "@/lib/stores/embed-server-store";
import { usePlaybackModeStore } from "@/lib/stores/playback-mode-store";
import { videoServers } from "@/lib/stores/video-servers";

export type {
  ServerAvailabilityInput,
  ServerOverride,
  VideoServer,
  VidsrcApi,
} from "@/lib/stores/embed-server-store";
export {
  defaultServerOverrides,
  pickFallbackEmbedServer,
  useEmbedServerStore,
  VIDSRC_MIRROR_APIS,
  videoServers,
} from "@/lib/stores/embed-server-store";
export { EMBED_ACCENT_COLOR } from "@/lib/providers/embed-urls";
export {
  isScrapeServer,
  scrapeServer,
  usePlaybackModeStore,
} from "@/lib/stores/playback-mode-store";

type CombinedServerState = ReturnType<typeof usePlaybackModeStore.getState> &
  ReturnType<typeof useEmbedServerStore.getState> & {
    /** @deprecated Use getFallbackEmbedServer instead */
    getAvailableServer: (
      tmdbId: number,
      type: "movie" | "tv",
    ) => import("@/lib/stores/video-servers").VideoServer;
  };

const getCombinedState = (): CombinedServerState => {
  const playback = usePlaybackModeStore.getState();
  const embed = useEmbedServerStore.getState();
  const currentServer = playback.selectedServer;
  const override = embed.serverOverrides.find(
    (entry) => entry.serverId === currentServer.id,
  );

  let resolvedServer = currentServer;
  if (override && !override.isAvailable) {
    for (const server of videoServers) {
      const serverOverride = embed.serverOverrides.find(
        (entry) => entry.serverId === server.id,
      );
      if (!serverOverride || serverOverride.isAvailable) {
        resolvedServer = server;
        break;
      }
    }
  }

  return {
    ...playback,
    ...embed,
    getAvailableServer: () => resolvedServer,
  };
};

export function useServerStore(): CombinedServerState;
export function useServerStore<T>(
  selector: (state: CombinedServerState) => T,
): T;
export function useServerStore<T>(
  selector?: (state: CombinedServerState) => T,
): CombinedServerState | T {
  const playback = usePlaybackModeStore();
  const embed = useEmbedServerStore();
  const combined = {
    ...playback,
    ...embed,
    getAvailableServer: (_tmdbId: number, _type: "movie" | "tv") => {
      void _tmdbId;
      void _type;
      return getCombinedState().getAvailableServer(_tmdbId, _type);
    },
  } as CombinedServerState;

  if (!selector) {
    return combined;
  }

  return selector(combined);
}

useServerStore.getState = getCombinedState;

useServerStore.setState = (
  partial:
    | Partial<CombinedServerState>
    | ((state: CombinedServerState) => Partial<CombinedServerState>),
) => {
  const current = getCombinedState();
  const patch = typeof partial === "function" ? partial(current) : partial;

  if (patch.selectedServer !== undefined) {
    usePlaybackModeStore.setState({ selectedServer: patch.selectedServer });
  }

  const embedPatch: Partial<ReturnType<typeof useEmbedServerStore.getState>> =
    {};
  if (patch.serverOverrides !== undefined) {
    embedPatch.serverOverrides = patch.serverOverrides;
  }
  if (patch.animePreference !== undefined) {
    embedPatch.animePreference = patch.animePreference;
  }
  if (patch.vidnestContentType !== undefined) {
    embedPatch.vidnestContentType = patch.vidnestContentType;
  }
  if (patch.vidsrcApi !== undefined) {
    embedPatch.vidsrcApi = patch.vidsrcApi;
  }
  if (patch.availabilityKey !== undefined) {
    embedPatch.availabilityKey = patch.availabilityKey;
  }
  if (patch.availableServerIds !== undefined) {
    embedPatch.availableServerIds = patch.availableServerIds;
  }
  if (patch.unavailableServerIds !== undefined) {
    embedPatch.unavailableServerIds = patch.unavailableServerIds;
  }

  if (Object.keys(embedPatch).length > 0) {
    useEmbedServerStore.setState(embedPatch);
  }
};

useServerStore.subscribe = (listener) => {
  const notify = () => listener(getCombinedState(), getCombinedState());
  const unsubPlayback = usePlaybackModeStore.subscribe(notify);
  const unsubEmbed = useEmbedServerStore.subscribe(notify);
  return () => {
    unsubPlayback();
    unsubEmbed();
  };
};
