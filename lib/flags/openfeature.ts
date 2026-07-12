import {
  evaluateBooleanFlag,
  readAdminFlagState,
} from "@/lib/flags/flipt-client";

export {
  invalidateFlagCache,
  readAdminFlagState,
  writeAdminFlagState,
} from "@/lib/flags/flipt-client";

export async function getBooleanFlag(
  key: string,
  defaultValue: boolean,
): Promise<boolean> {
  return evaluateBooleanFlag(key, defaultValue);
}

export async function getAllBooleanFlags(): Promise<Record<string, boolean>> {
  return readAdminFlagState();
}
