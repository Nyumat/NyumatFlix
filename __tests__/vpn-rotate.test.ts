import { afterEach, describe, expect, it } from "vitest";

import {
  authorizeScrapeVpnRotateRequest,
  scrapeRateLimitRotateHostname,
  scrapeVpnControlUrl,
  scrapeVpnRotateCountries,
} from "@/lib/scrape/vpn-rotate";

describe("vpn-rotate", () => {
  afterEach(() => {
    delete process.env.SCRAPE_VPN_CONTROL_URL;
    delete process.env.SCRAPE_VPN_ROTATE_SECRET;
    delete process.env.SCRAPE_VPN_ROTATE_COUNTRIES;
  });

  it("flags VidKing API host for rotate-on-429", () => {
    expect(scrapeRateLimitRotateHostname("api.wingsdatabase.com")).toBe(true);
    expect(scrapeRateLimitRotateHostname("kaa.lt")).toBe(false);
  });

  it("reads control URL from env", () => {
    process.env.SCRAPE_VPN_CONTROL_URL = "http://127.0.0.1:8000";
    expect(scrapeVpnControlUrl()).toBe("http://127.0.0.1:8000");
  });

  it("parses rotate countries", () => {
    process.env.SCRAPE_VPN_ROTATE_COUNTRIES = "Germany, Netherlands ,France";
    expect(scrapeVpnRotateCountries()).toEqual([
      "Germany",
      "Netherlands",
      "France",
    ]);
  });

  it("authorizes rotate endpoint via bearer or header", () => {
    process.env.SCRAPE_VPN_ROTATE_SECRET = "rotate-secret";
    const authorized = new Request("http://localhost/api/scrape/vpn/rotate", {
      headers: { authorization: "Bearer rotate-secret" },
    });
    const rejected = new Request("http://localhost/api/scrape/vpn/rotate");
    expect(authorizeScrapeVpnRotateRequest(authorized)).toBe(true);
    expect(authorizeScrapeVpnRotateRequest(rejected)).toBe(false);
  });
});
