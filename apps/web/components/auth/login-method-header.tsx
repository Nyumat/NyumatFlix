"use client";

import { Fingerprint, Mail } from "lucide-react";

import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePasskeySupport } from "@/hooks/use-passkey-support";

export function LoginMethodHeader({
  signupDisabled,
}: {
  signupDisabled: boolean;
}) {
  const passkeysSupported = usePasskeySupport();
  const Icon = passkeysSupported === false ? Mail : Fingerprint;

  return (
    <CardHeader className="items-center space-y-3 px-6 pb-6 pt-7 text-center sm:px-8 sm:pt-8">
      <div className="mb-1 flex size-12 items-center justify-center rounded-xl bg-white/[0.07] text-zinc-100">
        <Icon className="size-6" />
      </div>
      <CardTitle className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-white">
        Sign in
      </CardTitle>
      {signupDisabled || passkeysSupported !== false ? (
        <CardDescription className="max-w-sm text-sm leading-6 text-zinc-400">
          {signupDisabled
            ? "New accounts are paused. Existing members can still sign in."
            : "Use your face, fingerprint, or device screen lock. Nothing to remember."}
        </CardDescription>
      ) : null}
    </CardHeader>
  );
}
