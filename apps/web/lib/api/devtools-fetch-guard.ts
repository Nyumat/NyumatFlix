"use client";

const inflight = new Set<AbortController>();

let blocked = false;

export const isDevtoolsFetchBlocked = (): boolean => blocked;

export const setDevtoolsFetchBlocked = (value: boolean): void => {
  if (blocked === value) {
    return;
  }

  blocked = value;

  if (!value) {
    return;
  }

  for (const controller of inflight) {
    controller.abort();
  }
};

export const linkDevtoolsGuardSignal = (
  userSignal?: AbortSignal | null,
): { signal: AbortSignal; release: () => void } => {
  const guardController = new AbortController();
  inflight.add(guardController);

  const onUserAbort = () => {
    guardController.abort(userSignal?.reason);
  };

  if (userSignal) {
    if (userSignal.aborted) {
      guardController.abort(userSignal.reason);
    } else {
      userSignal.addEventListener("abort", onUserAbort, { once: true });
    }
  }

  if (blocked) {
    guardController.abort();
  }

  const release = () => {
    userSignal?.removeEventListener("abort", onUserAbort);
    inflight.delete(guardController);
  };

  return { signal: guardController.signal, release };
};

export const rejectDevtoolsBlockedFetch = (): Promise<Response> =>
  Promise.reject(
    new DOMException("Request blocked while DevTools is open", "AbortError"),
  );
