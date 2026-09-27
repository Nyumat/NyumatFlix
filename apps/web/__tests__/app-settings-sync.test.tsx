import { beforeEach, describe, expect, it } from "vitest";

import { getDefaultSiteFlags } from "@/lib/flags/site-flags";
import {
  scrapeServer,
  usePlaybackModeStore,
} from "@/lib/stores/playback-mode-store";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { videoServers } from "@/lib/stores/video-servers";
import { render, waitFor } from "@testing-library/react";
import React from "react";

import { AppSettingsSync } from "@/components/providers/app-settings-sync";
import { FeatureFlagsProvider } from "@/components/providers/feature-flags-provider";
import { resetUserSettingsHydratedForTests } from "@/lib/user/hydrate-user-settings";

const embedServer = videoServers[0]!;

function renderSync(flags = getDefaultSiteFlags()) {
  return render(
    <FeatureFlagsProvider flags={flags}>
      <AppSettingsSync />
    </FeatureFlagsProvider>,
  );
}

describe("AppSettingsSync", () => {
  beforeEach(() => {
    resetUserSettingsHydratedForTests();
    useAppSettingsStore.setState({
      noAdsMode: false,
      disableHeroTrailers: false,
    });
    usePlaybackModeStore.setState({
      selectedServer: embedServer,
      hasUserSelectedPlaybackServer: false,
      policyGenerationAtChoice: null,
    });
  });

  it("seeds scrape when no-ads default flag is enabled after flags load", async () => {
    const initialFlags = getDefaultSiteFlags();
    const { rerender } = renderSync(initialFlags);

    expect(useAppSettingsStore.getState().noAdsMode).toBe(false);
    expect(usePlaybackModeStore.getState().selectedServer.id).toBe(
      embedServer.id,
    );

    const updatedFlags = {
      ...initialFlags,
      noAdsModeDefault: true,
      policyGeneration: `${initialFlags.policyGeneration}|noAds:1`,
    };

    rerender(
      <FeatureFlagsProvider flags={updatedFlags}>
        <AppSettingsSync />
      </FeatureFlagsProvider>,
    );

    await waitFor(() => {
      expect(useAppSettingsStore.getState().noAdsMode).toBe(true);
      expect(usePlaybackModeStore.getState().selectedServer.id).toBe(
        scrapeServer.id,
      );
    });
  });

  it("seeds scrape for default proxy playback when nothing is persisted", async () => {
    renderSync({
      ...getDefaultSiteFlags(),
      defaultProxyPlayback: true,
      policyGeneration: `${getDefaultSiteFlags().policyGeneration}|proxyDefault:1`,
    });

    await waitFor(() => {
      expect(usePlaybackModeStore.getState().selectedServer.id).toBe(
        scrapeServer.id,
      );
    });
  });

  it("does not override a user-chosen embed server for default proxy playback", async () => {
    usePlaybackModeStore.setState({
      selectedServer: embedServer,
      hasUserSelectedPlaybackServer: true,
      policyGenerationAtChoice: getDefaultSiteFlags().policyGeneration,
    });

    renderSync({
      ...getDefaultSiteFlags(),
      defaultProxyPlayback: true,
    });

    await waitFor(() => {
      expect(usePlaybackModeStore.getState().selectedServer.id).toBe(
        embedServer.id,
      );
    });
  });

  it("forces embed server when iframe mode is locked", async () => {
    renderSync({
      ...getDefaultSiteFlags(),
      iframeModeOnly: true,
      policyGeneration: `${getDefaultSiteFlags().policyGeneration}|iframe:1`,
    });

    await waitFor(() => {
      expect(usePlaybackModeStore.getState().selectedServer.id).toBe(
        embedServer.id,
      );
      expect(useAppSettingsStore.getState().noAdsMode).toBe(false);
    });
  });

  it("does not flip the server before user settings hydrate", async () => {
    // Pre-hydration the selected server is just the store default; resolving
    // policy against it must not swap mid-scroll. No operator defaults, no
    // locks, no policy change -> stay put until hydrateUserSettings() lands.
    renderSync(getDefaultSiteFlags());

    // Let the sync effect run a few ticks; the server must not move.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(usePlaybackModeStore.getState().selectedServer.id).toBe(
      embedServer.id,
    );
  });
});
