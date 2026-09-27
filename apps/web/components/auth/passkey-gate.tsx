"use client";

import { AddPasskeyButton } from "@/components/auth/add-passkey-button";
import { PasskeyMark } from "@/components/auth/passkey-mark";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { usePasskeysEnabled } from "@/hooks/use-passkeys-enabled";
import { signOut, useSession } from "next-auth/react";
import type { ReactNode } from "react";

export function PasskeyGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const passkeysSupported = usePasskeySupport();
  const passkeysEnabled = usePasskeysEnabled();
  if (!passkeysEnabled) return children;
  if (status === "loading") {
    return (
      <p role="status" className="p-8 text-center text-muted-foreground">
        Checking sign-in…
      </p>
    );
  }
  if (!session?.user.requiresPasskey) return children;
  if (passkeysSupported === null) {
    return (
      <p role="status" className="p-8 text-center text-muted-foreground">
        Checking passkey support…
      </p>
    );
  }
  if (!passkeysSupported) return children;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-black px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(125,211,252,0.11),transparent_38%)]" />
      <section
        aria-labelledby="passkey-gate-title"
        className="relative w-full max-w-lg rounded-2xl border border-white/12 bg-zinc-950/90 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.62)] sm:p-9"
      >
        <BrandLogo placement="auth-compact" />
        <div className="mt-8 flex size-12 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/10 text-sky-200">
          <PasskeyMark className="size-7" />
        </div>
        <div className="mt-6 space-y-3">
          <h1
            id="passkey-gate-title"
            className="text-3xl font-semibold leading-tight tracking-[-0.025em]"
          >
            Passkeys are here!
          </h1>
          <p className="max-w-md text-sm leading-6 text-zinc-400">
            We now support passkeys for secure, blazing fast sign-in.
          </p>
        </div>

        <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5">
          <p className="text-xs font-medium text-zinc-500">Recovery email</p>
          <p className="mt-1 break-words text-sm font-medium text-zinc-200">
            {session.user.email}
          </p>
        </div>

        <div className="mt-7 space-y-3">
          <AddPasskeyButton
            label="Create passkey"
            showIcon={false}
            className="w-full cursor-pointer"
          />
          <p className="text-center text-xs leading-5 text-zinc-500">
            Your device will guide you through registration.
          </p>
        </div>

        <div className="mt-7 border-t border-white/10 pt-5 text-center">
          <Button
            variant="link"
            className="h-auto p-0 text-sm text-zinc-400 hover:text-white"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        </div>
      </section>
    </main>
  );
}
