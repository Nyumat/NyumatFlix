"use client";

import { Button } from "@/components/ui/button";
import type { MalSyncResult, MalSyncStatusResponse } from "@/lib/mal/types";
import { CheckCircle2, Loader2, RefreshCw, Tv, Unlink } from "lucide-react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function MalSyncPanel({
  isSignedIn,
  onStatusChange,
}: {
  isSignedIn: boolean;
  onStatusChange?: (status: MalSyncStatusResponse | null) => void;
}) {
  const [status, setStatus] = useState<MalSyncStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchStatus = async () => {
    if (!isSignedIn) {
      setLoading(false);
      onStatusChange?.(null);
      return;
    }
    try {
      const res = await fetch("/api/mal/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        onStatusChange?.(data);
      }
    } catch (err) {
      console.error("Error fetching MAL status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, [isSignedIn]);

  const handleConnect = () => {
    window.location.href = "/api/auth/mal/login?callbackUrl=/settings";
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/mal/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }
      const result: MalSyncResult = data.result;
      if (result.imported === 0 && result.updated === 0) {
        toast.info("Watchlist is already up to date with MyAnimeList");
      } else {
        toast.success(
          `Synced with MAL: ${result.imported} imported, ${result.updated} updated`,
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to sync MAL watchlist",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/mal/status", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to disconnect");
      }
      setStatus({ connected: false });
      onStatusChange?.({ connected: false });
      toast.success("Disconnected MyAnimeList");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to disconnect MyAnimeList",
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-zinc-400">
          <Loader2 className="size-4 animate-spin" />
          Checking MyAnimeList connection...
        </div>
      ) : status?.connected ? (
        <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {status.malPicture ? (
                <div className="relative size-10 overflow-hidden rounded-full border border-white/15 bg-white/5">
                  <Image
                    src={status.malPicture}
                    alt={status.malUsername || "MAL User"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-[#2e51a2]/20 text-[#2e51a2]">
                  <Tv className="size-5" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">
                    {status.malUsername || "MyAnimeList Account"}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="size-3" />
                    Connected
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Automatic progress scrobbling & watchlist sync active
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/12 bg-black/30 hover:bg-white/10 text-xs"
                onClick={handleSyncNow}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 size-3.5" />
                )}
                Sync Now
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Unlink className="mr-1.5 size-3.5" />
                )}
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {status?.reauthRequired
                ? "Reconnect MyAnimeList"
                : "Connect MyAnimeList"}
            </p>
            <p className="text-xs text-zinc-400">
              {status?.reauthRequired
                ? "Your authorization expired or was revoked. Reconnect to resume syncing."
                : "Sync your watchlist and auto-track anime episode playback progress."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-[#2E51A2]/40 bg-[#2E51A2] hover:bg-[#254285] text-white gap-2.5 text-xs font-semibold shadow-sm"
            onClick={handleConnect}
          >
            <div className="relative h-4.5 w-16 shrink-0">
              <Image
                src="/myanimelist-logo.png"
                alt="MyAnimeList"
                fill
                className="object-contain"
              />
            </div>
          </Button>
        </div>
      )}
    </div>
  );
}
