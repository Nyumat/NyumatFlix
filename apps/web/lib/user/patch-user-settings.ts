"use client";

import type { UserSettingsPatch } from "@/lib/user/user-settings-types";
import { getSession } from "next-auth/react";

export const patchUserSettings = async (
  patch: UserSettingsPatch,
): Promise<void> => {
  const session = await getSession();
  if (!session?.user?.id) {
    return;
  }

  await fetch("/api/user/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
};
