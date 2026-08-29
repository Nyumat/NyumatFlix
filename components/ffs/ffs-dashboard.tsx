"use client";

import { AuthTogglesPanel } from "@/components/ffs/auth-toggles-panel";
import { FfsSaveBar } from "@/components/ffs/ffs-save-bar";
import { GlobalTogglesPanel } from "@/components/ffs/global-toggles-panel";
import { PowerFeaturesPanel } from "@/components/ffs/power-features-panel";
import { ProviderMatrixPanel } from "@/components/ffs/provider-matrix-panel";
import { ProviderMenuOrderPanel } from "@/components/ffs/provider-menu-order-panel";
import { AnnouncementBannerPanel } from "@/components/ffs/announcement-banner-panel";
import {
  DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  type AnnouncementBannerConfig,
} from "@/lib/flags/announcement-banner";
import {
  DEFAULT_PROVIDER_MENU_ORDER,
  providerMenuOrderEquals,
  type ProviderMenuOrderConfig,
} from "@/lib/flags/provider-menu-order";
import { broadcastSiteFlagsUpdated } from "@/lib/flags/flags-sync";
import {
  applyPlaybackMutualExclusion,
  buildDefaultAdminFlagState,
  type AdminFlagState,
} from "@/lib/flags/flag-catalog";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

type FfsDashboardProps = {
  initialFlags: AdminFlagState;
  initialAnnouncementBanner: AnnouncementBannerConfig;
  initialProviderMenuOrder: ProviderMenuOrderConfig;
};

export function FfsDashboard({
  initialFlags,
  initialAnnouncementBanner,
  initialProviderMenuOrder,
}: FfsDashboardProps) {
  const [saved, setSaved] = useState(initialFlags);
  const [draft, setDraft] = useState(initialFlags);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(initialAnnouncementBanner);
  const [draftBanner, setDraftBanner] = useState(initialAnnouncementBanner);
  const [savedMenuOrder, setSavedMenuOrder] = useState(
    initialProviderMenuOrder,
  );
  const [draftMenuOrder, setDraftMenuOrder] = useState(
    initialProviderMenuOrder,
  );

  const dirty = useMemo(
    () =>
      JSON.stringify(saved) !== JSON.stringify(draft) ||
      JSON.stringify(savedBanner) !== JSON.stringify(draftBanner) ||
      !providerMenuOrderEquals(savedMenuOrder, draftMenuOrder),
    [saved, draft, savedBanner, draftBanner, savedMenuOrder, draftMenuOrder],
  );

  const onChange = useCallback((key: string, value: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onBulkChange = useCallback((keys: string[], value: boolean) => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = value;
      return next;
    });
  }, []);

  const onReset = useCallback(() => {
    setDraft(saved);
    setDraftBanner(savedBanner);
    setDraftMenuOrder(savedMenuOrder);
  }, [saved, savedBanner, savedMenuOrder]);

  const onSave = useCallback(async () => {
    setSaving(true);
    const payload = applyPlaybackMutualExclusion(draft);
    try {
      const res = await fetch("/api/ffs/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flags: payload,
          announcementBanner: draftBanner,
          providerMenuOrder: draftMenuOrder,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Save failed (${res.status})`);
      }
      const data = (await res.json()) as {
        flags: AdminFlagState;
        announcementBanner: AnnouncementBannerConfig;
        providerMenuOrder: ProviderMenuOrderConfig;
      };
      setSaved(data.flags);
      setDraft(data.flags);
      setSavedBanner(data.announcementBanner);
      setDraftBanner(data.announcementBanner);
      setSavedMenuOrder(data.providerMenuOrder);
      setDraftMenuOrder(data.providerMenuOrder);
      broadcastSiteFlagsUpdated();
      toast.success("Flags saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, draftBanner, draftMenuOrder]);

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6 pb-24 pt-8">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-primary/80">
            Feature flags
          </p>
          <h1 className="text-2xl font-semibold text-white">
            NyumatFlix admin
          </h1>
          <p className="text-sm text-white/55">
            Global toggles apply to all users after save (open tabs refresh on
            focus).
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <GlobalTogglesPanel flags={draft} onChange={onChange} />
          <AuthTogglesPanel flags={draft} onChange={onChange} />
        </div>

        <PowerFeaturesPanel flags={draft} onChange={onChange} />
        <AnnouncementBannerPanel
          enabled={draft["global.announcement_banner"] ?? false}
          config={draftBanner}
          onEnabledChange={(enabled) =>
            onChange("global.announcement_banner", enabled)
          }
          onConfigChange={setDraftBanner}
        />
        <ProviderMatrixPanel
          flags={draft}
          onChange={onChange}
          onBulkChange={onBulkChange}
        />
        <ProviderMenuOrderPanel
          flags={draft}
          menuOrder={draftMenuOrder}
          onMenuOrderChange={setDraftMenuOrder}
        />
      </div>

      <FfsSaveBar
        dirty={dirty}
        saving={saving}
        onReset={onReset}
        onSave={onSave}
      />
    </>
  );
}

export function FfsDashboardFallback() {
  return (
    <FfsDashboard
      initialFlags={buildDefaultAdminFlagState()}
      initialAnnouncementBanner={DEFAULT_ANNOUNCEMENT_BANNER_CONFIG}
      initialProviderMenuOrder={DEFAULT_PROVIDER_MENU_ORDER}
    />
  );
}
