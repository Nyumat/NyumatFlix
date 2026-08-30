import { describe, expect, it, beforeEach } from "vitest";

import {
  DEFAULT_PLAYER_ENGINE,
  PLAYER_ENGINE_STORAGE_KEY,
  readStoredPlayerEngine,
  resolvePlayerEngine,
  writePlayerEnginePreference,
} from "@/hooks/use-movi-preview";

describe("player engine preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to vidstack when no preference is stored", () => {
    expect(DEFAULT_PLAYER_ENGINE).toBe("vidstack");
    expect(resolvePlayerEngine()).toBe("vidstack");
    expect(readStoredPlayerEngine()).toBeNull();
  });

  it("persists and reads client player engine preference", () => {
    writePlayerEnginePreference("movi");
    expect(window.localStorage.getItem(PLAYER_ENGINE_STORAGE_KEY)).toBe("movi");
    expect(readStoredPlayerEngine()).toBe("movi");
    expect(resolvePlayerEngine()).toBe("movi");
  });

  it("ignores unknown stored values", () => {
    window.localStorage.setItem(PLAYER_ENGINE_STORAGE_KEY, "legacy");
    expect(readStoredPlayerEngine()).toBeNull();
    expect(resolvePlayerEngine()).toBe("vidstack");
  });
});
