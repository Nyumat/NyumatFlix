"use client";

import { syncPasskeySignals } from "@/lib/passkeys/signal-client";
import type { PasskeySignalPayload } from "@/lib/passkeys/signal-payload";
import { usePasskeyCapabilities } from "@/hooks/use-passkey-capabilities";
import { usePasskeysEnabled } from "@/hooks/use-passkeys-enabled";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { z } from "zod";

const signalResponse = z.object({
  signal: z
    .object({
      rpId: z.string(),
      groups: z.array(
        z.object({
          userId: z.string(),
          allAcceptedCredentialIds: z.array(z.string()),
        }),
      ),
      userName: z.string(),
      displayName: z.string(),
    })
    .nullable(),
});

async function fetchSignalPayload(): Promise<PasskeySignalPayload | null> {
  const response = await fetch("/api/account/passkeys/signal", {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const parsed = signalResponse.parse(await response.json());
  return parsed.signal;
}

export function PasskeySignalSync() {
  const passkeysEnabled = usePasskeysEnabled();
  const { data: session, status } = useSession();
  const capabilities = usePasskeyCapabilities();
  const lastSyncKey = useRef<string | null>(null);

  useEffect(() => {
    if (!passkeysEnabled) return;
    if (status !== "authenticated" || !session?.user.id) return;
    if (!capabilities?.signal.allAcceptedCredentials) return;

    const syncKey = [
      session.user.id,
      session.user.email ?? "",
      session.user.name ?? "",
    ].join(":");

    if (lastSyncKey.current === syncKey) return;
    lastSyncKey.current = syncKey;

    void (async () => {
      const payload = await fetchSignalPayload();
      if (!payload) return;
      await syncPasskeySignals(payload);
    })();
  }, [
    passkeysEnabled,
    capabilities?.signal.allAcceptedCredentials,
    session?.user.email,
    session?.user.id,
    session?.user.name,
    status,
  ]);

  return null;
}

export async function refreshPasskeySignals(): Promise<void> {
  const payload = await fetchSignalPayload();
  if (!payload) return;
  await syncPasskeySignals(payload);
}
