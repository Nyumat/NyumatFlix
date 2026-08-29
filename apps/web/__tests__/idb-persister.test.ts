import { createIDBPersister } from "@/lib/idb-persister";
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

import { del, get, set } from "idb-keyval";

const mockGet = get as ReturnType<typeof vi.fn>;
const mockSet = set as ReturnType<typeof vi.fn>;
const mockDel = del as ReturnType<typeof vi.fn>;

describe("createIDBPersister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("creates a persister with correct interface", () => {
    const persister = createIDBPersister();

    expect(persister).toHaveProperty("persistClient");
    expect(persister).toHaveProperty("restoreClient");
    expect(persister).toHaveProperty("removeClient");
    expect(typeof persister.persistClient).toBe("function");
    expect(typeof persister.restoreClient).toBe("function");
    expect(typeof persister.removeClient).toBe("function");
  });

  test("persistClient calls idb-keyval set with correct key", async () => {
    const persister = createIDBPersister();
    const mockClient: PersistedClient = {
      timestamp: Date.now(),
      buster: "",
      clientState: {
        mutations: [],
        queries: [],
      },
    };

    await persister.persistClient(mockClient);

    expect(mockSet).toHaveBeenCalledWith("nyumatflix-query-cache", mockClient);
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  test("restoreClient calls idb-keyval get with correct key", async () => {
    const mockClient: PersistedClient = {
      timestamp: Date.now(),
      buster: "",
      clientState: {
        mutations: [],
        queries: [],
      },
    };
    mockGet.mockResolvedValueOnce(mockClient);

    const persister = createIDBPersister();
    const result = await persister.restoreClient();

    expect(mockGet).toHaveBeenCalledWith("nyumatflix-query-cache");
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockClient);
  });

  test("restoreClient returns undefined when no cached data exists", async () => {
    mockGet.mockResolvedValueOnce(undefined);

    const persister = createIDBPersister();
    const result = await persister.restoreClient();

    expect(mockGet).toHaveBeenCalledWith("nyumatflix-query-cache");
    expect(result).toBeUndefined();
  });

  test("removeClient calls idb-keyval del with correct key", async () => {
    const persister = createIDBPersister();

    await persister.removeClient();

    expect(mockDel).toHaveBeenCalledWith("nyumatflix-query-cache");
    expect(mockDel).toHaveBeenCalledTimes(1);
  });

  test("handles set errors gracefully", async () => {
    mockSet.mockRejectedValueOnce(new Error("Storage quota exceeded"));

    const persister = createIDBPersister();
    const mockClient: PersistedClient = {
      timestamp: Date.now(),
      buster: "",
      clientState: {
        mutations: [],
        queries: [],
      },
    };

    await expect(persister.persistClient(mockClient)).rejects.toThrow(
      "Storage quota exceeded",
    );
  });

  test("handles get errors gracefully", async () => {
    mockGet.mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    const persister = createIDBPersister();

    await expect(persister.restoreClient()).rejects.toThrow(
      "IndexedDB unavailable",
    );
  });

  test("handles del errors gracefully", async () => {
    mockDel.mockRejectedValueOnce(new Error("Delete failed"));

    const persister = createIDBPersister();

    await expect(persister.removeClient()).rejects.toThrow("Delete failed");
  });
});
