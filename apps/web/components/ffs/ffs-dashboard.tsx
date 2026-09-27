"use client";

import { AuthTogglesPanel } from "@/components/ffs/auth-toggles-panel";
import { ExperienceDefaultsPanel } from "@/components/ffs/experience-defaults-panel";
import { FfsSaveBar } from "@/components/ffs/ffs-save-bar";
import { GlobalTogglesPanel } from "@/components/ffs/global-toggles-panel";
import { PowerFeaturesPanel } from "@/components/ffs/power-features-panel";
import { ProviderMatrixPanel } from "@/components/ffs/provider-matrix-panel";
import { ProviderMenuOrderPanel } from "@/components/ffs/provider-menu-order-panel";
import { AnnouncementBannerPanel } from "@/components/ffs/announcement-banner-panel";
import { HeroBackdropPanel } from "@/components/ffs/hero-backdrop-panel";
import { SurfacesTogglesPanel } from "@/components/ffs/surfaces-toggles-panel";
import { SettingsSection } from "@/components/ffs/settings";
import { Separator } from "@/components/ui/separator";
import {
  DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  type AnnouncementBannerConfig,
} from "@/lib/flags/announcement-banner";
import {
  DEFAULT_EXPERIENCE_DEFAULTS,
  experienceDefaultsEquals,
  type ExperienceDefaultsConfig,
} from "@/lib/flags/experience-defaults";
import {
  DEFAULT_PROVIDER_MENU_ORDER,
  providerMenuOrderEquals,
  type ProviderMenuOrderConfig,
} from "@/lib/flags/provider-menu-order";
import {
  DEFAULT_HERO_BACKDROP_OVERRIDES,
  heroBackdropOverridesEquals,
  type HeroBackdropOverridesConfig,
} from "@/lib/flags/hero-backdrop-overrides";
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
  initialHeroBackdropOverrides: HeroBackdropOverridesConfig;
  initialExperienceDefaults: ExperienceDefaultsConfig;
};

export function FfsDashboard({
  initialFlags,
  initialAnnouncementBanner,
  initialProviderMenuOrder,
  initialHeroBackdropOverrides,
  initialExperienceDefaults,
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
  const [savedOverrides, setSavedOverrides] = useState(
    initialHeroBackdropOverrides,
  );
  const [draftOverrides, setDraftOverrides] = useState(
    initialHeroBackdropOverrides,
  );
  const [savedExperienceDefaults, setSavedExperienceDefaults] = useState(
    initialExperienceDefaults,
  );
  const [draftExperienceDefaults, setDraftExperienceDefaults] = useState(
    initialExperienceDefaults,
  );
  const [previewSyncToken, setPreviewSyncToken] = useState(0);

  const dirty = useMemo(
    () =>
      JSON.stringify(saved) !== JSON.stringify(draft) ||
      JSON.stringify(savedBanner) !== JSON.stringify(draftBanner) ||
      !providerMenuOrderEquals(savedMenuOrder, draftMenuOrder) ||
      !heroBackdropOverridesEquals(savedOverrides, draftOverrides) ||
      !experienceDefaultsEquals(
        savedExperienceDefaults,
        draftExperienceDefaults,
      ),
    [
      saved,
      draft,
      savedBanner,
      draftBanner,
      savedMenuOrder,
      draftMenuOrder,
      savedOverrides,
      draftOverrides,
      savedExperienceDefaults,
      draftExperienceDefaults,
    ],
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
    setDraftOverrides(savedOverrides);
    setDraftExperienceDefaults(savedExperienceDefaults);
    setPreviewSyncToken((token) => token + 1);
  }, [
    saved,
    savedBanner,
    savedMenuOrder,
    savedOverrides,
    savedExperienceDefaults,
  ]);

  const onSave = useCallback(async () => {
    setSaving(true);
    setPreviewSyncToken((token) => token + 1);
    const payload = applyPlaybackMutualExclusion(draft);
    try {
      const res = await fetch("/api/ffs/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flags: payload,
          announcementBanner: draftBanner,
          providerMenuOrder: draftMenuOrder,
          heroBackdropOverrides: draftOverrides,
          experienceDefaults: draftExperienceDefaults,
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
        heroBackdropOverrides: HeroBackdropOverridesConfig;
        experienceDefaults: ExperienceDefaultsConfig;
      };
      setSaved(data.flags);
      setDraft(data.flags);
      setSavedBanner(data.announcementBanner);
      setDraftBanner(data.announcementBanner);
      setSavedMenuOrder(data.providerMenuOrder);
      setDraftMenuOrder(data.providerMenuOrder);
      setSavedOverrides(data.heroBackdropOverrides);
      setDraftOverrides(data.heroBackdropOverrides);
      setSavedExperienceDefaults(data.experienceDefaults);
      setDraftExperienceDefaults(data.experienceDefaults);
      setPreviewSyncToken((token) => token + 1);
      broadcastSiteFlagsUpdated();
      toast.success("Flags saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [
    draft,
    draftBanner,
    draftMenuOrder,
    draftOverrides,
    draftExperienceDefaults,
  ]);

  return (
    <>
      <div className="ffs-admin mx-auto max-w-5xl space-y-10 px-4 pb-24 pt-8">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Feature flags
          </p>
          <h1 className="text-lg font-medium text-foreground">
            NyumatFlix admin
          </h1>
          <p className="text-xs text-muted-foreground">
            Saved flags apply the next time a tab focuses the site.
          </p>
        </header>

        <SettingsSection
          title="Experience defaults"
          description="Site-wide preference defaults for new visitors."
        >
          <ExperienceDefaultsPanel
            config={draftExperienceDefaults}
            onChange={setDraftExperienceDefaults}
          />
        </SettingsSection>

        <Separator />

        <div className="grid gap-10 lg:grid-cols-2">
          <SettingsSection title="Playback">
            <GlobalTogglesPanel flags={draft} onChange={onChange} />
          </SettingsSection>
          <SettingsSection title="Authentication">
            <AuthTogglesPanel flags={draft} onChange={onChange} />
          </SettingsSection>
        </div>

        <Separator />

        <SettingsSection title="Surfaces">
          <SurfacesTogglesPanel flags={draft} onChange={onChange} />
        </SettingsSection>

        <Separator />

        <SettingsSection title="Infrastructure">
          <PowerFeaturesPanel flags={draft} onChange={onChange} />
        </SettingsSection>

        <Separator />

        <SettingsSection
          title="Providers"
          description="Show or hide providers in the server selector and scrape dispatch."
        >
          <ProviderMatrixPanel
            flags={draft}
            onChange={onChange}
            onBulkChange={onBulkChange}
          />
        </SettingsSection>

        <Separator />

        <SettingsSection title="Announcement">
          <AnnouncementBannerPanel
            enabled={draft["global.announcement_banner"] ?? false}
            config={draftBanner}
            onEnabledChange={(enabled) =>
              onChange("global.announcement_banner", enabled)
            }
            onConfigChange={setDraftBanner}
          />
        </SettingsSection>

        <Separator />

        <SettingsSection
          title="Server menu order"
          description="Drag to reorder how sources appear in the server selector."
        >
          <ProviderMenuOrderPanel
            flags={draft}
            menuOrder={draftMenuOrder}
            onMenuOrderChange={setDraftMenuOrder}
          />
        </SettingsSection>

        <Separator />

        <SettingsSection
          title="Index hero pins"
          description="Pin up to five titles per hub. Each hub has its own hero lineup and backdrop."
        >
          <HeroBackdropPanel
            overrides={draftOverrides}
            onOverridesChange={setDraftOverrides}
            previewSyncToken={previewSyncToken}
          />
        </SettingsSection>
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
      initialHeroBackdropOverrides={DEFAULT_HERO_BACKDROP_OVERRIDES}
      initialExperienceDefaults={DEFAULT_EXPERIENCE_DEFAULTS}
    />
  );
}
