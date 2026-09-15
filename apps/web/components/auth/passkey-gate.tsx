"use client";

import { AddPasskeyButton } from "@/components/auth/add-passkey-button";
import { Button } from "@/components/ui/button";
import { Fingerprint } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import type { ReactNode } from "react";

export function PasskeyGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  if (status === "loading") {
    return (
      <p role="status" className="p-8 text-center text-muted-foreground">
        Checking sign-in…
      </p>
    );
  }
  if (!session?.user.requiresPasskey) return children;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <section
        aria-labelledby="passkey-gate-title"
        className="w-full max-w-md space-y-5 rounded-2xl border border-white/12 bg-zinc-950 p-8"
      >
        <Fingerprint className="size-8 text-sky-200" />
        <h1 id="passkey-gate-title" className="text-2xl font-semibold">
          Add a passkey
        </h1>
        <p className="text-sm leading-6 text-zinc-400">
          Add a passkey to continue. Next time, sign in with your fingerprint,
          face, or device screen lock.
        </p>
        <p className="break-words text-sm text-zinc-400">
          {session.user.email} stays your backup if you lose access to your
          passkeys.
        </p>
        <AddPasskeyButton />
        <Button
          variant="ghost"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Button>
      </section>
    </main>
  );
}
