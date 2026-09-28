import { describe, expect, it } from "vitest";

import {
  decideDirectExhaustion,
  shouldAttemptStreamAfterProbe,
} from "@/lib/direct/playbackFailure";

describe("shouldAttemptStreamAfterProbe", () => {
  it("plays a stream the range probe could not see", () => {
    expect(shouldAttemptStreamAfterProbe({ ok: false, status: null })).toBe(
      true,
    );
  });

  it("plays a stream the probe could read", () => {
    expect(shouldAttemptStreamAfterProbe({ ok: true, status: 206 })).toBe(true);
  });

  it("skips a stream the server rejected", () => {
    expect(shouldAttemptStreamAfterProbe({ ok: false, status: 404 })).toBe(
      false,
    );
    expect(shouldAttemptStreamAfterProbe({ ok: false, status: 403 })).toBe(
      false,
    );
  });
});

describe("decideDirectExhaustion", () => {
  it("reloads once before declaring every stream dead", () => {
    expect(
      decideDirectExhaustion({
        freshRetryStarted: false,
        freshPlaybackStarted: false,
      }),
    ).toBe("reload");
  });

  it("ignores a second failure until the fresh list has started", () => {
    expect(
      decideDirectExhaustion({
        freshRetryStarted: true,
        freshPlaybackStarted: false,
      }),
    ).toBe("wait");
  });

  it("fails only after the fresh list has played and died", () => {
    expect(
      decideDirectExhaustion({
        freshRetryStarted: true,
        freshPlaybackStarted: true,
      }),
    ).toBe("failed");
  });
});
