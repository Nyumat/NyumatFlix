"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Mail } from "lucide-react";
import { createElement, useEffect, useState } from "react";

type FloatingCapLoginFormProps = {
  action: (formData: FormData) => Promise<void>;
  endpoint: string;
};

export function FloatingCapLoginForm({
  action,
  endpoint,
}: FloatingCapLoginFormProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void import("@cap.js/widget")
      .then(() => import("@cap.js/widget/cap-floating.min.js"))
      .then(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <form action={action} className="space-y-5">
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
          className="h-12 rounded-xl border-white/12 bg-black/35 px-4 text-base text-white shadow-none placeholder:text-zinc-600 focus-visible:ring-sky-300/80 focus-visible:ring-offset-0 dark:border-white/12 dark:bg-black/35"
        />
      </div>
      {createElement("cap-widget", {
        id: "login-cap",
        required: true,
        "data-cap-api-endpoint": endpoint,
        "data-cap-hidden-field-name": "cap-token",
      })}
      <Button
        type="submit"
        size="lg"
        data-cap-floating="#login-cap"
        data-cap-floating-position="top"
        disabled={!ready}
        className="h-12 w-full rounded-xl border-sky-300/20 bg-sky-300/15 px-5 text-sm font-semibold text-sky-50 shadow-none hover:border-sky-300/35 hover:bg-sky-300/22"
      >
        <Mail className="mr-2 size-4" />
        Continue with email
        <ArrowRight className="ml-2 size-4 transition-transform group-hover/arrow:translate-x-0.5" />
      </Button>
    </form>
  );
}
