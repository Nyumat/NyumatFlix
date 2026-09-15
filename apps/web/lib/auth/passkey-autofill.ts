"use client";

import {
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  WebAuthnAbortService,
} from "@simplewebauthn/browser";
import { getCsrfToken } from "next-auth/react";
import { z } from "zod";

const authenticationOptions = z.object({
  action: z.literal("authenticate"),
  options: z.object({
    challenge: z.string(),
    rpId: z.string().optional(),
    timeout: z.number().optional(),
    userVerification: z
      .enum(["required", "preferred", "discouraged"])
      .optional(),
  }),
});

// Auth.js's signIn helper always opens a modal. Autofill uses the same
// options/callback endpoints and CSRF protection, with conditional mediation.
export function startPasskeyAutofill(callbackUrl: string) {
  const controller = new AbortController();
  const pending = (async () => {
    if (!(await browserSupportsWebAuthnAutofill()) || controller.signal.aborted)
      return;
    const response = await fetch(
      "/api/auth/webauthn-options/passkey?action=authenticate",
      {
        signal: controller.signal,
      },
    );
    if (!response.ok || controller.signal.aborted) return;
    const { options } = authenticationOptions.parse(await response.json());
    if (controller.signal.aborted) return;
    const credential = await startAuthentication(options, true);
    if (controller.signal.aborted) return;
    const csrfToken = await getCsrfToken();
    if (controller.signal.aborted) return;
    const result = await fetch("/api/auth/callback/passkey", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams({
        action: "authenticate",
        data: JSON.stringify(credential),
        csrfToken,
        callbackUrl,
      }),
    });
    if (!result.ok || controller.signal.aborted) return;
    const body = z.object({ url: z.string() }).parse(await result.json());
    const destination = new URL(body.url, window.location.origin);
    if (destination.origin === window.location.origin) {
      window.location.assign(destination.href);
    }
  })().catch(() => {
    // Unsupported, dismissed, and interrupted autofill stays silent. The
    // explicit passkey button and email backup remain available.
  });

  return async () => {
    controller.abort();
    WebAuthnAbortService.cancelCeremony();
    await pending;
  };
}
