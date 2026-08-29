import {
  isDevtoolsFetchBlocked,
  linkDevtoolsGuardSignal,
  setDevtoolsFetchBlocked,
} from "@/lib/api/devtools-fetch-guard";
import { afterEach, describe, expect, test } from "vitest";

describe("devtools-fetch-guard", () => {
  afterEach(() => {
    setDevtoolsFetchBlocked(false);
  });

  test("blocks new guarded signals when devtools is open", () => {
    setDevtoolsFetchBlocked(true);

    const { signal, release } = linkDevtoolsGuardSignal();
    expect(isDevtoolsFetchBlocked()).toBe(true);
    expect(signal.aborted).toBe(true);
    release();
  });

  test("aborts in-flight guarded requests when devtools opens", () => {
    const { signal, release } = linkDevtoolsGuardSignal();
    expect(signal.aborted).toBe(false);

    setDevtoolsFetchBlocked(true);
    expect(signal.aborted).toBe(true);

    release();
    setDevtoolsFetchBlocked(false);
  });

  test("unblocks guarded signals after devtools closes", () => {
    setDevtoolsFetchBlocked(true);
    setDevtoolsFetchBlocked(false);

    const { signal, release } = linkDevtoolsGuardSignal();
    expect(signal.aborted).toBe(false);
    release();
  });

  test("propagates user aborts to the guard signal", () => {
    const userController = new AbortController();
    const { signal, release } = linkDevtoolsGuardSignal(userController.signal);

    userController.abort("user-cancelled");
    expect(signal.aborted).toBe(true);

    release();
  });
});
