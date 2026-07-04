import {
  checkVideoServerUrl,
  isAllowedVideoServerUrl,
} from "@/lib/server/video-server-health";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("video server health", () => {
  afterEach(() => vi.restoreAllMocks());

  it("only allows configured HTTPS video server hosts", () => {
    expect(isAllowedVideoServerUrl("https://vidfast.pro/movie/123")).toBe(true);
    expect(isAllowedVideoServerUrl("http://vidfast.pro/movie/123")).toBe(false);
    expect(
      isAllowedVideoServerUrl("https://vidfast.pro.evil.test/movie/123"),
    ).toBe(false);
    expect(isAllowedVideoServerUrl("https://user@vidfast.pro/movie/123")).toBe(
      false,
    );
    expect(isAllowedVideoServerUrl("https://127.0.0.1/movie/123")).toBe(false);
  });

  it("uses a direct status for providers whose status is meaningful", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await expect(
      checkVideoServerUrl("https://vsembed.ru/embed/movie?tmdb=550"),
    ).resolves.toMatchObject({
      available: true,
      state: "available",
      status: 200,
      evidence: "http-status",
    });
  });

  it("reports a meaningful non-success status as unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    await expect(
      checkVideoServerUrl("https://vsembed.ru/embed/movie?tmdb=404"),
    ).resolves.toMatchObject({
      available: false,
      state: "unavailable",
      status: 404,
    });
  });

  it("keeps opaque player shells unknown instead of trusting HTTP 200", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      checkVideoServerUrl("https://vidfast.pro/movie/550"),
    ).resolves.toMatchObject({
      available: false,
      state: "unknown",
      status: null,
      evidence: "opaque-player",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks 2Embed unavailable when its nested player redirects home", async () => {
    const redirectedHome = new Response("home", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
    Object.defineProperty(redirectedHome, "url", {
      value: "https://www.2embed.cc/",
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          '<iframe data-src="https://streamsrcs.2embed.cc/xps-tv?tmdb=61663&s=1&e=18">',
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response('<iframe src="61663/1/18?autostart=true">', {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(redirectedHome);

    await expect(
      checkVideoServerUrl("https://www.2embed.cc/embedtv/61663&s=1&e=18"),
    ).resolves.toMatchObject({
      available: false,
      state: "unavailable",
      evidence: "nested-player",
    });
  });

  it("reports VidNest available when any resolver returns source data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("upstream", { status: 502 }))
      .mockResolvedValueOnce(
        Response.json({ encrypted: true, data: "resolver-payload" }),
      )
      .mockResolvedValue(new Response("upstream", { status: 502 }));

    await expect(
      checkVideoServerUrl("https://vidnest.fun/movie/550"),
    ).resolves.toMatchObject({
      available: true,
      state: "available",
      evidence: "resolver",
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://new.vidnest.fun/movies5f/movie/550",
      expect.objectContaining({
        headers: expect.objectContaining({ Referer: "https://vidnest.fun/" }),
      }),
    );
  });

  it("checks VidNest anime against its anime resolver", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ encrypted: true, data: "anime-resolver-payload" }),
      );

    await expect(
      checkVideoServerUrl("https://vidnest.fun/anime/103275/2/sub"),
    ).resolves.toMatchObject({
      available: true,
      state: "available",
      evidence: "resolver",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://new.vidnest.fun/hianime/anime/103275/2/sub",
      expect.anything(),
    );
  });

  it("reports VidNest unavailable when every responding resolver fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("upstream", { status: 502 }),
    );

    await expect(
      checkVideoServerUrl("https://vidnest.fun/tv/1399/1/1"),
    ).resolves.toMatchObject({
      available: false,
      state: "unavailable",
      evidence: "resolver",
    });
  });

  it("does not resolve incomplete VidNest TV paths", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      checkVideoServerUrl("https://vidnest.fun/tv/1399"),
    ).resolves.toMatchObject({
      state: "unknown",
      evidence: "opaque-player",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports network-only failures as unknown", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));

    await expect(
      checkVideoServerUrl("https://vidnest.fun/movie/550"),
    ).resolves.toMatchObject({
      available: false,
      state: "unknown",
      status: null,
      evidence: "network",
    });
  });
});
