"use client";

import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2 } from "lucide-react";
import { signIn } from "next-auth/webauthn";
import { useState } from "react";

export function AddPasskeyButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addPasskey() {
    setBusy(true);
    setError("");
    try {
      const result = await signIn("passkey", {
        action: "register",
        redirect: false,
      });
      if (!result?.ok || result.error) {
        throw new Error("Registration failed");
      }
      // Reload both the server gate and the settings list with the new cookie.
      window.location.reload();
    } catch {
      setError(
        "Passkey was not added. Try again and finish your device’s prompt.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={addPasskey} disabled={busy}>
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Fingerprint className="mr-2 size-4" />
        )}
        {busy ? "Adding passkey…" : "Add a passkey"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
