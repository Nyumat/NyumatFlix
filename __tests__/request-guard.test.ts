import {
  NYUMAT_CLIENT_HEADER,
  NYUMAT_CLIENT_VALUE,
  apiRequestGuardResponse,
  isApiRequestGuardExempt,
} from "@/lib/api/request-guard";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("apiRequestGuardResponse", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("exempts health, auth, cap, ffs, and playback proxy routes", () => {
    expect(isApiRequestGuardExempt("/api/healthz")).toBe(true);
    expect(isApiRequestGuardExempt("/api/auth/session")).toBe(true);
    expect(isApiRequestGuardExempt("/api/cap/challenge")).toBe(true);
    expect(isApiRequestGuardExempt("/api/ffs/flags")).toBe(true);
    expect(isApiRequestGuardExempt("/api/scrape/play/token/asset.m3u8")).toBe(
      true,
    );
    expect(isApiRequestGuardExempt("/api/live/play/token/index.m3u8")).toBe(
      true,
    );
    expect(isApiRequestGuardExempt("/api/direct/media?u=test")).toBe(true);
    expect(
      isApiRequestGuardExempt("/api/direct/transcode/playlist?u=test"),
    ).toBe(true);
    expect(isApiRequestGuardExempt("/api/direct/session")).toBe(false);
    expect(isApiRequestGuardExempt("/api/search")).toBe(false);
  });

  test("allows development traffic without the client header", () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = new NextRequest("http://localhost:3000/api/search");
    expect(apiRequestGuardResponse(request)).toBeNull();
  });

  test("blocks production api calls without the client header", () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("http://localhost:3000/api/search");
    const response = apiRequestGuardResponse(request);
    expect(response?.status).toBe(403);
  });

  test("allows production api calls with the client header", () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("http://localhost:3000/api/search", {
      headers: { [NYUMAT_CLIENT_HEADER]: NYUMAT_CLIENT_VALUE },
    });
    expect(apiRequestGuardResponse(request)).toBeNull();
  });

  test("blocks cross-site mutations in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      headers: {
        [NYUMAT_CLIENT_HEADER]: NYUMAT_CLIENT_VALUE,
        "sec-fetch-site": "cross-site",
      },
    });
    expect(apiRequestGuardResponse(request)?.status).toBe(403);
  });
});
