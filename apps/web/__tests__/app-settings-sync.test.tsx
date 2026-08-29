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

const embedServer = videoServers[0]!;

function renderSync(flags = getDefaultSiteFlags()) {
  return render(
    <FeatureFlagsProvider flags={flags}>
      <AppSettingsSync />
    </FeatureFlagsProvider>,
  );
}

describe("AppSettingsSync", () => {
  beforeEach(async () => {
    localStorage.clear();
    await useAppSettingsStore.persist.rehydrate();
    await usePlaybackModeStore.persist.rehydrate();
    useAppSettingsStore.setState({ noAdsMode: false });
    usePlaybackModeStore.setState({ selectedServer: embedServer });
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
    localStorage.clear();
    await usePlaybackModeStore.persist.rehydrate();

    renderSync({
      ...getDefaultSiteFlags(),
      defaultProxyPlayback: true,
    });

    await waitFor(() => {
      expect(usePlaybackModeStore.getState().selectedServer.id).toBe(
        scrapeServer.id,
      );
    });
  });

  it("does not override a persisted embed server for default proxy playback alone", async () => {
    localStorage.setItem(
      "playback-mode-storage",
      JSON.stringify({
        state: { selectedServerId: embedServer.id },
        version: 0,
      }),
    );
    await usePlaybackModeStore.persist.rehydrate();

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

  it("clears seeded no-ads mode when the default flag is turned off", async () => {
    const flagsWithNoAdsDefault = {
      ...getDefaultSiteFlags(),
      noAdsModeDefault: true,
    };
    const { rerender } = renderSync(flagsWithNoAdsDefault);

    await waitFor(() => {
      expect(useAppSettingsStore.getState().noAdsMode).toBe(true);
    });

    rerender(
      <FeatureFlagsProvider flags={getDefaultSiteFlags()}>
        <AppSettingsSync />
      </FeatureFlagsProvider>,
    );

    await waitFor(() => {
      expect(useAppSettingsStore.getState().noAdsMode).toBe(false);
    });
  });
});
