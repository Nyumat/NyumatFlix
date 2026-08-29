import {
  NYUMAT_CLIENT_HEADER,
  NYUMAT_CLIENT_VALUE,
} from "@/lib/api/request-guard";
import { mergeScrapeHlsClientAuthConfig } from "@/lib/api/scrape-hls-client-auth";
import { describe, expect, test } from "vitest";

describe("mergeScrapeHlsClientAuthConfig", () => {
  test("adds the nyumat client header for internal playback urls", async () => {
    const config = mergeScrapeHlsClientAuthConfig({});
    expect(config.fetchSetup).toBeTypeOf("function");

    const request = await Promise.resolve(
      config.fetchSetup!(
        {
          url: "https://nyumatflix.com/api/scrape/play/token/asset.m3u8",
        } as never,
        { method: "GET" },
      ),
    );

    expect(request.headers.get(NYUMAT_CLIENT_HEADER)).toBe(NYUMAT_CLIENT_VALUE);
  });

  test("leaves external urls untouched", async () => {
    const config = mergeScrapeHlsClientAuthConfig({});
    const request = await Promise.resolve(
      config.fetchSetup!(
        { url: "https://cdn.example.com/segment.ts" } as never,
        { method: "GET" },
      ),
    );

    expect(request.headers.get(NYUMAT_CLIENT_HEADER)).toBeNull();
  });
});
