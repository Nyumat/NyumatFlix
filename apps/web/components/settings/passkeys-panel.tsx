"use client";

import { AddPasskeyButton } from "@/components/auth/add-passkey-button";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { z } from "zod";

const passkeysResponse = z.object({
  passkeys: z.array(
    z.object({
      credentialID: z.string(),
      credentialDeviceType: z.string(),
      credentialBackedUp: z.boolean(),
    }),
  ),
});

export function PasskeysPanel({ email }: { email: string }) {
  const { data: session, update } = useSession();
  const queryClient = useQueryClient();
  const queryKey = ["passkeys", session?.user.id];
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { data, isPending, isError, refetch } = useQuery({
    queryKey,
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
    )
      return;
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
    } catch {
      setError("Could not remove this passkey. Try again.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Passkeys</h2>
        <p className="break-words text-sm text-muted-foreground">
          Use a passkey to sign in. {email} is your backup.
        </p>
      </div>
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
      <ul className="space-y-2">
        {data?.map((passkey, index) => (
          <li
            key={passkey.credentialID}
            className="flex items-center justify-between gap-4 rounded-lg border border-white/10 p-3"
          >
            <div>
              <p className="text-sm font-medium">
                Passkey {index + 1}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {passkey.credentialID.slice(0, 8)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {passkey.credentialBackedUp
                  ? "Synced passkey"
                  : "Device passkey"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={removing !== null}
              aria-label={`Remove passkey ${index + 1}`}
              onClick={() => removePasskey(passkey.credentialID)}
            >
              {removing === passkey.credentialID ? "Removing…" : "Remove"}
            </Button>
          </li>
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
