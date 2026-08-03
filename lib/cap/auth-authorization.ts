import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

const verifiedSignIn = new AsyncLocalStorage<boolean>();

export const withCapVerifiedSignIn = <T>(
  action: () => Promise<T>,
): Promise<T> => verifiedSignIn.run(true, action);

export const isCapVerifiedSignIn = (): boolean =>
  verifiedSignIn.getStore() === true;
