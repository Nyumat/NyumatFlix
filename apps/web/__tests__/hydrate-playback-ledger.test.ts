import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PLAYBACK_PROGRESS_STORAGE_KEY,
  type ListedPlaybackProgress,
} from "@/lib/playback/progress-storage";
import { hydrateSignedInPlaybackLedger } from "@/lib/playback/hydrate-playback-ledger";
import {
  clearSignedInLedger,
  readLedgerMap,
  resetGuestLedger,
} from "@/lib/playback/progress-ledger-facade";

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", () => ({
  getSession: getSessionMock,
}));

describe("hydrateSignedInPlaybackLedger", () => {
  beforeEach(() => {
    resetGuestLedger();
    clearSignedInLedger();
    window.localStorage.clear();
    getSessionMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates legacy local progress through the playback progress api", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    window.localStorage.setItem(
      PLAYBACK_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        "movie:550::": {
          watched: 1200,
          duration: 7200,
          updatedAt: 1_700_000_000_000,
        },
      }),
    );

    const serverEntries: ListedPlaybackProgress[] = [
      {
        mediaType: "movie",
        contentId: 550,
        watched: 1200,
        duration: 7200,
        updatedAt: 1_700_000_000_000,
        storageKey: "movie:550::",
      },
    ];

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: serverEntries }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: serverEntries }),
      } as Response);

    await hydrateSignedInPlaybackLedger();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/playback/progress",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          entries: [
            {
              mediaType: "movie",
              contentId: 550,
              watchedSeconds: 1200,
              durationSeconds: 7200,
              updatedAt: 1_700_000_000_000,
            },
          ],
        }),
      }),
    );

    expect(
      window.localStorage.getItem(
        "nyumatflix:playback-ledger-migrated:user-1",
      ),
    ).toBe("true");
    expect(window.localStorage.getItem(PLAYBACK_PROGRESS_STORAGE_KEY)).toBeNull();
    expect(readLedgerMap()["movie:550::"]?.watched).toBe(1200);
  });

  it("does not mark migration complete when bulk save fails", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-2" } });

    window.localStorage.setItem(
      PLAYBACK_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        "movie:551::": {
          watched: 300,
          duration: 3600,
          updatedAt: 1_700_000_000_001,
        },
      }),
    );

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "failed" }),
      } as Response);

    await hydrateSignedInPlaybackLedger();

    expect(
      window.localStorage.getItem(
        "nyumatflix:playback-ledger-migrated:user-2",
      ),
    ).toBeNull();
    expect(window.localStorage.getItem(PLAYBACK_PROGRESS_STORAGE_KEY)).not.toBeNull();
  });
});
