"use client";

import { useServerStore } from "@/lib/stores/server-store";
import { useCallback, useState } from "react";

export interface UseServerManagementState {
  customReason: string;
  editingServerId: string | null;
}

export interface UseServerManagementActions {
  setCustomReason: (value: string) => void;
  setEditingServerId: (id: string | null) => void;
  handleToggleServer: (
    serverId: string,
    isAvailable: boolean,
    reason?: string,
  ) => void;
  handleCustomReason: (serverId: string) => void;
  getServerStatus: (serverId: string) => "available" | "unavailable";
}

export interface UseServerManagementReturn
  extends UseServerManagementState,
    UseServerManagementActions {}

export const useServerManagement = (): UseServerManagementReturn => {
  const {
    setServerOverride,
    removeServerOverride,
    getServerOverride,
    isServerOverridden,
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
  };
};

export type UseServerManagement = typeof useServerManagement;
