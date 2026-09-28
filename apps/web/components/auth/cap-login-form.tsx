"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasskeyMark } from "@/components/auth/passkey-mark";
import { isCapDevBypassEnabled } from "@/lib/cap/constants";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { usePasskeysEnabled } from "@/hooks/use-passkeys-enabled";
import { warmCapWidgetAssets } from "@/lib/cap/warmup-client";
import { Loader2 } from "lucide-react";
import { createElement, useEffect, useRef, useState } from "react";

import { signIn } from "next-auth/webauthn";
import { startPasskeyAutofill } from "@/lib/auth/passkey-autofill";

type CapLoginFormProps = {
  action: (formData: FormData) => Promise<void>;
  endpoint: string;
  callbackUrl?: string;
};

export function CapLoginForm({
  action,
  endpoint,
  callbackUrl = "/",
}: CapLoginFormProps) {
  const devBypass = isCapDevBypassEnabled();
  const [ready, setReady] = useState(devBypass);
  const [isVerifying, setIsVerifying] = useState(false);

  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState("");
  const [showEmailBackup, setShowEmailBackup] = useState(false);
  const passkeysEnabled = usePasskeysEnabled();
  const passkeysSupported = usePasskeySupport();
  const stopAutofill = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!passkeysEnabled || passkeysSupported !== true) return;
    const stop = startPasskeyAutofill(callbackUrl);
    stopAutofill.current = stop;
    return () => {
      void stop();
    };
  }, [callbackUrl, passkeysEnabled, passkeysSupported]);

  async function continueWithPasskey() {
    setPasskeyBusy(true);
    setPasskeyError("");
    await stopAutofill.current?.();
    try {
      const result = await signIn("passkey", {
        action: "authenticate",
        redirect: false,
        redirectTo: callbackUrl,
      });
      if (!result?.ok || result.error || !result.url)
        throw new Error("Sign-in failed");
      window.location.assign(result.url);
    } catch {
      setPasskeyError(
        "Could not sign in with a passkey. Try again or use your email backup.",
      );
      setPasskeyBusy(false);
    }
  }

  useEffect(() => {
    if (devBypass) return;
    let active = true;
    void warmCapWidgetAssets()
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [devBypass]);

  const handleSubmit = () => {
    void stopAutofill.current?.();
    setIsVerifying(true);
  };

  const isBusy = isVerifying || passkeyBusy;

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-zinc-200">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          autoComplete={
            passkeysSupported === true ? "username webauthn" : "email"
          }
          type="email"
          placeholder="you@example.com"
          required
          disabled={isBusy}
          className="h-10 rounded-lg border-white/12 bg-black/35 px-4 text-base text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-sky-300/80 focus-visible:ring-offset-0 dark:border-white/12 dark:bg-black/35"
        />
      </div>
      {passkeysSupported === true ? (
        <Button
          type="button"
          size="lg"
          disabled={isBusy}
          onClick={continueWithPasskey}
          className="h-10 w-full rounded-lg border-white bg-white text-zinc-950 shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:border-white hover:bg-zinc-200 hover:text-zinc-950 dark:border-white dark:bg-white dark:text-zinc-950 dark:hover:border-white dark:hover:bg-zinc-200 dark:hover:text-zinc-950"
        >
          {passkeyBusy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <PasskeyMark className="mr-2 size-5" />
          )}
          Continue with passkey
        </Button>
      ) : null}
      {passkeysSupported === true && passkeyError ? (
        <p role="alert" className="text-sm text-red-400">
          {passkeyError}
        </p>
      ) : null}
      {passkeysSupported === false || showEmailBackup ? (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-center text-xs leading-5 text-zinc-500">
            We’ll email you a one-time sign-in link.
          </p>
          {devBypass ? null : (
            <div className="cap-login-widget">
              {createElement("cap-widget", {
                id: "login-cap",
                class: "cap-login",
                required: true,
                "data-cap-api-endpoint": endpoint,
                "data-cap-hidden-field-name": "cap-token",
                "data-cap-i18n-initial-state": "Verify you're human",
                "data-cap-i18n-solved-label": "Verified",
                "data-cap-i18n-verifying-label": "Verifying...",
              })}
            </div>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={!ready || isBusy}
            className="h-10 w-full rounded-lg border-white/15 bg-white/[0.06] px-5 text-sm font-semibold text-white shadow-none hover:border-white/25 hover:bg-white/10"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Sending sign-in link…
              </>
            ) : (
              "Continue with email"
            )}
          </Button>
        </div>
      ) : passkeysSupported === true ? (
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full text-sm text-zinc-400 hover:border-transparent hover:bg-white/[0.04] hover:text-white"
          onClick={() => setShowEmailBackup(true)}
        >
          Use email backup
        </Button>
      ) : null}
    </form>
  );
}
