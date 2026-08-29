import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { WatchlistItem } from "@/lib/domain/watchlist";
import { applyContinueWatchingComplete } from "@/lib/watchlist/apply-continue-watching-complete";

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function watchlistItem(overrides: Partial<WatchlistItem> = {}): WatchlistItem {
  return {
    id: "item-1",
    userId: "user-123",
    contentId: 123,
    mediaType: "movie",
    status: "watching",
    lastWatchedSeason: null,
    lastWatchedEpisode: null,
    lastWatchedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("applyContinueWatchingComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  test("does not call the API when status is null", async () => {
    await applyContinueWatchingComplete({
      contentId: 123,
      mediaType: "movie",
      status: null,
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("PATCHes an existing item to completed", async () => {
    const item = watchlistItem();
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({ item }))
      .mockResolvedValueOnce(
        jsonResponse({ item: { ...item, status: "completed" } }),
      );

    await applyContinueWatchingComplete({
      contentId: 123,
      mediaType: "movie",
      status: "completed",
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/watchlist/item?contentId=123&mediaType=movie",
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2, "/api/watchlist/item-1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "completed" }),
    });
  });

  test("PATCHes an existing TV item to completed with last watched", async () => {
    const item = watchlistItem({
      contentId: 1399,
      mediaType: "tv",
    });
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({ item }))
      .mockResolvedValueOnce(jsonResponse({ item }));

    await applyContinueWatchingComplete({
      contentId: 1399,
      mediaType: "tv",
      status: "completed",
      seasonNumber: 2,
      episodeNumber: 5,
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/watchlist/item?contentId=1399&mediaType=tv",
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2, "/api/watchlist/item-1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "completed",
        lastWatchedSeason: 2,
        lastWatchedEpisode: 5,
      }),
    });
  });

  test("POSTs completed when no item exists", async () => {
    const created = watchlistItem({ status: "completed" });
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({ item: null }))
      .mockResolvedValueOnce(jsonResponse({ item: created }, 201));

    await applyContinueWatchingComplete({
      contentId: 123,
      mediaType: "movie",
      status: "completed",
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/watchlist/item?contentId=123&mediaType=movie",
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2, "/api/watchlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentId: 123,
        mediaType: "movie",
        status: "completed",
      }),
    });
  });

  test("GETs and PATCHes after POST 409", async () => {
    const existing = watchlistItem({ status: "watching" });
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({ item: null }))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Item already in watchlist" }, 409),
      )
      .mockResolvedValueOnce(jsonResponse({ item: existing }))
      .mockResolvedValueOnce(
        jsonResponse({ item: { ...existing, status: "completed" } }),
      );

    await applyContinueWatchingComplete({
      contentId: 123,
      mediaType: "movie",
      status: "completed",
    });

    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/watchlist/item?contentId=123&mediaType=movie",
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2, "/api/watchlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentId: 123,
        mediaType: "movie",
        status: "completed",
      }),
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "/api/watchlist/item?contentId=123&mediaType=movie",
    );
    expect(global.fetch).toHaveBeenNthCalledWith(4, "/api/watchlist/item-1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "completed" }),
    });
  });

  test("throws when GET is not ok", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    );

    await expect(
      applyContinueWatchingComplete({
        contentId: 123,
        mediaType: "movie",
        status: "completed",
      }),
    ).rejects.toThrow("Failed to fetch watchlist item");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/watchlist/item?contentId=123&mediaType=movie",
    );
  });
});
