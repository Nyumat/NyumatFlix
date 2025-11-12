"use client";

import { useServerStore } from "@/lib/stores/server-store";
import { useCallback, useState } from "react";

export interface UseServerManagementState {
  customReason: string;
  editingServerId: string | null;
  animePreference: "sub" | "dub";
  vidnestContentType: "movie" | "tv" | "anime" | "animepahe";
}

export interface UseServerManagementActions {
  setCustomReason: (value: string) => void;
  setEditingServerId: (id: string | null) => void;
  setAnimePreference: (preference: "sub" | "dub") => void;
  setVidnestContentType: (type: "movie" | "tv" | "anime" | "animepahe") => void;
  handleToggleServer: (
    serverId: string,
    isAvailable: boolean,
    reason?: string,
  ) => void;
  handleCustomReason: (serverId: string) => void;
  getServerStatus: (serverId: string) => "available" | "unavailable";
  getAnimeUrl: (serverId: string, anilistId: number, episode: number) => string;
  getAnimePaheUrl: (
    serverId: string,
    anilistId: number,
    episode: number,
  ) => string;
}

export interface UseServerManagementReturn
  extends UseServerManagementState,
    UseServerManagementActions {}

export const useServerManagement = (): UseServerManagementReturn => {
  const {
    setServerOverride,
    removeServerOverride,
    getServerOverride,
    animePreference,
    setAnimePreference,
    vidnestContentType,
    setVidnestContentType,
    getAnimeUrl,
    getAnimePaheUrl,
  } = useServerStore();

  const [customReason, setCustomReason] = useState<string>("");
  const [editingServerId, setEditingServerId] = useState<string | null>(null);

  const handleToggleServer = useCallback(
    (serverId: string, isAvailable: boolean, reason?: string) => {
      if (isAvailable) {
        removeServerOverride(serverId);
      } else {
        setServerOverride(serverId, false, reason || "Manually disabled");
      }
    },
    [removeServerOverride, setServerOverride],
  );

  const handleCustomReason = useCallback(
    (serverId: string) => {
      if (customReason.trim()) {
        setServerOverride(serverId, false, customReason.trim());
        setCustomReason("");
        setEditingServerId(null);
      }
    },
    [customReason, setServerOverride],
  );

  const getServerStatus = useCallback(
    (serverId: string): "available" | "unavailable" => {
      const override = getServerOverride(serverId);
      if (!override) return "available";
      return override.isAvailable ? "available" : "unavailable";
    },
    [getServerOverride],
  );

  return {
    customReason,
    editingServerId,
    setCustomReason,
    setEditingServerId,
    handleToggleServer,
    handleCustomReason,
    getServerStatus,
    animePreference,
    setAnimePreference,
    vidnestContentType,
    setVidnestContentType,
    getAnimeUrl,
    getAnimePaheUrl,
  };
};

export type UseServerManagement = typeof useServerManagement;
