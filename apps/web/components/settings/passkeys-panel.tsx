"use client";

import { AddPasskeyButton } from "@/components/auth/add-passkey-button";
import { PasskeyListItem } from "@/components/settings/passkey-list-item";
import { Button } from "@/components/ui/button";
import { refreshPasskeySignals } from "@/components/providers/passkey-signal-sync";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { usePasskeysEnabled } from "@/hooks/use-passkeys-enabled";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

const passkeysResponse = z.object({
  passkeys: z.array(
    z.object({
      credentialID: z.string(),
      credentialDeviceType: z.string(),
      credentialBackedUp: z.boolean(),
      aaguid: z.string().nullable(),
      nickname: z.string().nullable(),
      authenticatorName: z.string().nullable(),
      title: z.string(),
      subtitle: z.string(),
    }),
  ),
});

export function PasskeysPanel() {
  const passkeysEnabled = usePasskeysEnabled();
  const passkeysSupported = usePasskeySupport();
  const { data: session, update } = useSession();
  const queryClient = useQueryClient();
  const queryKey = ["passkeys", session?.user.id];
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { data, isPending, isError, refetch } = useQuery({
    queryKey,
    enabled: passkeysEnabled,
    queryFn: async () => {
      const response = await fetch("/api/account/passkeys", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load passkeys");
      return passkeysResponse.parse(await response.json()).passkeys;
    },
  });

  async function removePasskey(credentialID: string) {
    if (
      !window.confirm(
        "Remove this passkey? If it is your last one, you will need to add another to continue. Email remains your backup.",
      )
    ) {
      return;
    }

    setRemoving(credentialID);
    setError("");
    try {
      const response = await fetch("/api/account/passkeys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialID }),
      });
      if (!response.ok) throw new Error("Could not remove passkey");
      await queryClient.invalidateQueries({ queryKey });
      await update();
      await refreshPasskeySignals();
    } catch {
      setError("Could not remove this passkey. Try again.");
    } finally {
      setRemoving(null);
    }
  }

  async function renamePasskey(credentialID: string, nickname: string) {
    const response = await fetch(
      `/api/account/passkeys/${encodeURIComponent(credentialID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(payload?.error ?? "Could not rename passkey");
    }

    await queryClient.invalidateQueries({ queryKey });
    toast.success("Passkey renamed");
  }

  if (!passkeysEnabled) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Passkeys</h2>
      {isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading passkeys…
        </p>
      ) : null}
      {isError ? (
        <div role="alert">
          Could not load passkeys.{" "}
          <Button variant="ghost" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No passkeys added yet.</p>
      ) : null}
      {passkeysSupported === false ? (
        <p className="text-sm text-muted-foreground">
          This browser does not support passkeys. Use a compatible browser to
          add one.
        </p>
      ) : null}
      <ul className="space-y-2">
        {data?.map((passkey) => (
          <PasskeyListItem
            key={passkey.credentialID}
            passkey={passkey}
            removing={removing === passkey.credentialID}
            onRemove={() => removePasskey(passkey.credentialID)}
            onRename={(nickname) =>
              renamePasskey(passkey.credentialID, nickname)
            }
          />
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      <AddPasskeyButton />
    </div>
  );
}
