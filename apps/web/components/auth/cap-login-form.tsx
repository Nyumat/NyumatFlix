"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isCapDevBypassEnabled } from "@/lib/cap/constants";
import { warmCapWidgetAssets } from "@/lib/cap/warmup-client";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { createElement, useEffect, useState } from "react";

type CapLoginFormProps = {
  action: (formData: FormData) => Promise<void>;
  endpoint: string;
};

export function CapLoginForm({ action, endpoint }: CapLoginFormProps) {
  const devBypass = isCapDevBypassEnabled();
  const [ready, setReady] = useState(devBypass);
  const [isVerifying, setIsVerifying] = useState(false);

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
    setIsVerifying(true);
  };

  const isBusy = isVerifying;

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2.5">
        <Label htmlFor="email" className="text-sm font-medium text-zinc-200">
          Email address
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          disabled={isBusy}
          className="h-12 rounded-xl border-white/12 bg-black/35 px-4 text-base text-white shadow-none placeholder:text-zinc-600 focus-visible:ring-sky-300/80 focus-visible:ring-offset-0 dark:border-white/12 dark:bg-black/35"
        />
      </div>
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
        className="h-12 w-full rounded-xl border-sky-300/20 bg-sky-300/15 px-5 text-sm font-semibold text-sky-50 shadow-none hover:border-sky-300/35 hover:bg-sky-300/22"
      >
        {isBusy ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Sending magic link...
          </>
        ) : (
          <>
            <Mail className="mr-2 size-4" />
            Continue with email
            <ArrowRight className="ml-2 size-4 transition-transform group-hover/arrow:translate-x-0.5" />
          </>
        )}
      </Button>
    </form>
  );
}
