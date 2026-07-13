import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ALL_FLAG_DEFINITIONS,
  buildDefaultAdminFlagState,
} from "@/lib/flags/flag-catalog";
import {
  ensureFlagsSeeded,
  invalidateFlagCache,
  toFliptStorageKey,
  writeAdminFlagState,
} from "@/lib/flags/flipt-client";

const originalFetch = globalThis.fetch;

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
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ resources, revision: "revision-1" }),
      )
      .mockResolvedValueOnce(
        Response.json({ revision: "revision-2" }, { status: 200 }),
      );
    globalThis.fetch = fetchMock;

    await writeAdminFlagState({
      ...buildDefaultAdminFlagState(),
      [changed.key]: !changed.defaultValue,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1] ?? [];
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
