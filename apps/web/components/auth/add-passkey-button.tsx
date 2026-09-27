"use client";

import { Button } from "@/components/ui/button";
import { PasskeyMark } from "@/components/auth/passkey-mark";
import { cn } from "@/lib/utils";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { usePasskeysEnabled } from "@/hooks/use-passkeys-enabled";
import { refreshPasskeySignals } from "@/components/providers/passkey-signal-sync";
import { registerPasskey } from "@/lib/passkeys/client-register-passkey";
import { Loader2 } from "lucide-react";
import { useState } from "react";

type AddPasskeyButtonProps = {
  label?: string;
  className?: string;
  showIcon?: boolean;
};

export function AddPasskeyButton({
  label = "Add a passkey",
  className,
  showIcon = true,
}: AddPasskeyButtonProps = {}) {
  const passkeysEnabled = usePasskeysEnabled();
  const passkeysSupported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addPasskey() {
    setBusy(true);
    setError("");
    try {
      const registration = await registerPasskey();
      await fetch("/api/account/passkeys/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialID: registration.credentialID,
          attestationObject: registration.attestationObject,
        }),
      }).catch(() => undefined);
      await refreshPasskeySignals();
      window.location.reload();
    } catch {
      setError(
        "Passkey was not added. Try again and finish your device’s prompt.",
      );
      setBusy(false);
    }
  }

  if (!passkeysEnabled) return null;

  if (passkeysSupported === null) {
    return (
      <Button type="button" disabled className={cn(className)}>
        <Loader2 className="mr-2 size-4 animate-spin" />
        Checking passkey support…
      </Button>
    );
  }

  if (!passkeysSupported) return null;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={addPasskey}
        disabled={busy}
        className={cn(className)}
      >
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : showIcon ? (
          <PasskeyMark className="mr-2 size-4" />
        ) : null}
        {busy ? "Creating passkey…" : label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
