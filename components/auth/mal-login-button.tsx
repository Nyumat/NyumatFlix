"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

type MalLoginButtonProps = {
  /** Where MAL should send the user back to after authorizing. Defaults to `/`. */
  callbackUrl?: string;
  /** Helper copy shown above the button. Pass `null` to omit it entirely. */
  helperText?: string | null;
};

export function MalLoginButton({
  callbackUrl = "/",
  helperText = "Or use your MyAnimeList account to continue",
}: MalLoginButtonProps = {}) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = () => {
    setLoading(true);
    window.location.href = `/api/auth/mal/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  };

  return (
    <div className="space-y-2.5">
      {helperText ? (
        <p className="text-center text-xs font-medium text-zinc-400">
          {helperText}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        aria-label="Continue with MyAnimeList"
        className="group relative flex h-12 w-full items-center justify-center rounded-xl border border-white/12 bg-white/5 px-6 py-2 transition-all duration-200 hover:border-[#2e51a2]/60 hover:bg-[#2e51a2]/15 active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="size-5 animate-spin text-zinc-400" />
        ) : (
          <div className="relative h-5 w-28 transition-transform duration-200 group-hover:scale-105">
            <Image
              src="/myanimelist-logo.png"
              alt="MyAnimeList"
              fill
              className="object-contain"
              priority
            />
          </div>
        )}
      </button>
    </div>
  );
}
