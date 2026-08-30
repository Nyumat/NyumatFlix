import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ALL_FLAG_DEFINITIONS,
  buildDefaultAdminFlagState,
} from "@/lib/flags/flag-catalog";
import {
  ensureFlagsSeeded,
  invalidateFlagCache,
  readAnnouncementBannerConfig,
  readFliptMetadataValue,
  toFliptStorageKey,
  writeAdminFlagState,
} from "@/lib/flags/flipt-client";
import { DEFAULT_ANNOUNCEMENT_BANNER_CONFIG } from "@/lib/flags/announcement-banner";

const originalFetch = globalThis.fetch;

const notFoundResponse = () => new Response("not found", { status: 404 });

const mockFlagWrites = (
  listBody: Response,
  mutateBody: Response,
): ReturnType<typeof vi.fn<typeof fetch>> =>
  vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    if (method === "PUT" || method === "POST") {
      return mutateBody;
    }
    const url = String(input);
    if (
      url.includes("/resources/flipt.core.Flag/") &&
      !url.endsWith("/resources/flipt.core.Flag")
    ) {
      return notFoundResponse();
    }
    return listBody;
  });

const resource = (def: (typeof ALL_FLAG_DEFINITIONS)[number]) => ({
  key: toFliptStorageKey(def.key),
  payload: {
    "@type": "flipt.core.Flag",
    key: toFliptStorageKey(def.key),
    name: def.label,
    description: def.description ?? "",
    enabled: def.defaultValue,
    type: "BOOLEAN_FLAG_TYPE",
  },
});

describe("Flipt v2 client", () => {
  beforeEach(() => {
    invalidateFlagCache();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("seeds missing flags through the v2 resource API", async () => {
    const missing = ALL_FLAG_DEFINITIONS[0];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          resources: ALL_FLAG_DEFINITIONS.slice(1).map(resource),
          revision: "revision-1",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ revision: "revision-2" }, { status: 200 }),
      );
    globalThis.fetch = fetchMock;

    await ensureFlagsSeeded();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/api/v2/environments/default/namespaces/default/resources/flipt.core.Flag",
    );
    const [url, init] = fetchMock.mock.calls[1] ?? [];
    expect(url).toContain(
      "/api/v2/environments/default/namespaces/default/resources",
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      key: toFliptStorageKey(missing.key),
      revision: "revision-1",
      payload: {
        "@type": "flipt.core.Flag",
        key: toFliptStorageKey(missing.key),
        enabled: missing.defaultValue,
        type: "BOOLEAN_FLAG_TYPE",
      },
    });
  });

  it("updates only changed flags and carries the v2 revision", async () => {
    const changed = ALL_FLAG_DEFINITIONS[0];
    const resources = ALL_FLAG_DEFINITIONS.map((def) => {
      const current = resource(def);
      return def.key === changed.key
        ? {
            ...current,
            payload: {
              ...current.payload,
              metadata: { owner: "nyumatflix" },
            },
          }
        : current;
    });
    const fetchMock = mockFlagWrites(
      Response.json({ resources, revision: "revision-1" }),
      Response.json({ revision: "revision-2" }, { status: 200 }),
    );
    globalThis.fetch = fetchMock;

    await writeAdminFlagState({
      ...buildDefaultAdminFlagState(),
      [changed.key]: !changed.defaultValue,
    });

    const putCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "PUT",
    );
    expect(putCall).toBeDefined();
    const [url, init] = putCall ?? [];
    expect(url).toContain(
      "/api/v2/environments/default/namespaces/default/resources",
    );
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      key: toFliptStorageKey(changed.key),
      revision: "revision-1",
      payload: {
        "@type": "flipt.core.Flag",
        key: toFliptStorageKey(changed.key),
        enabled: !changed.defaultValue,
        metadata: { owner: "nyumatflix" },
      },
    });
  });

  it("maps dotted catalog keys to Flipt v2 storage keys", () => {
    expect(toFliptStorageKey("global.proxy_mode_only")).toBe(
      "global_proxy_mode_only",
    );
  });

  it("stores announcement presentation in flag metadata", async () => {
    const resources = ALL_FLAG_DEFINITIONS.map(resource);
    const fetchMock = mockFlagWrites(
      Response.json({ resources, revision: "revision-1" }),
      Response.json({ revision: "revision-2" }, { status: 200 }),
    );
    globalThis.fetch = fetchMock;

    const announcementBanner = {
      ...DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
      title: "Service update",
    };
    await writeAdminFlagState(buildDefaultAdminFlagState(), announcementBanner);

    const putCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "PUT",
    );
    expect(JSON.parse(String(putCall?.[1]?.body))).toMatchObject({
      key: toFliptStorageKey("global.announcement_banner"),
      payload: {
        metadata: { announcementBanner: JSON.stringify(announcementBanner) },
      },
    });
  });

  it("reads announcement presentation from GetResource metadata", async () => {
    const announcementBanner = {
      ...DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
      title: "Service update",
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        resource: {
          key: toFliptStorageKey("global.announcement_banner"),
          payload: {
            "@type": "flipt.core.Flag",
            key: toFliptStorageKey("global.announcement_banner"),
            enabled: true,
            type: "BOOLEAN_FLAG_TYPE",
            name: "Announcement",
            description: "",
            metadata: {
              announcementBanner: JSON.stringify(announcementBanner),
            },
          },
        },
      }),
    );
    globalThis.fetch = fetchMock;

    await expect(readAnnouncementBannerConfig()).resolves.toEqual(
      announcementBanner,
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      `/resources/flipt.core.Flag/${toFliptStorageKey("global.announcement_banner")}`,
    );
  });

  it("parses string or object flag metadata values", () => {
    expect(
      readFliptMetadataValue(
        { announcementBanner: '{"title":"Hi"}' },
        "announcementBanner",
      ),
    ).toEqual({ title: "Hi" });
    expect(
      readFliptMetadataValue(
        { announcementBanner: { title: "Hi" } },
        "announcementBanner",
      ),
    ).toEqual({ title: "Hi" });
  });

  it("does not attempt writes when the initial read fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("upstream down", { status: 503 }));
    globalThis.fetch = fetchMock;

    await expect(
      writeAdminFlagState(buildDefaultAdminFlagState()),
    ).rejects.toThrow("Flipt list flags failed: 503 upstream down");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
