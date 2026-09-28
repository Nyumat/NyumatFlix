import { startRegistration } from "@simplewebauthn/browser";
import {
  readWebAuthnClientFeatures,
  resolveRegistrationHints,
} from "@/lib/passkeys/client-capabilities";
import { getCsrfToken } from "next-auth/react";

export type PasskeyRegistrationResult = {
  credentialID: string;
  attestationObject: string;
};

export async function registerPasskey(): Promise<PasskeyRegistrationResult> {
  const csrfToken = await getCsrfToken();
  if (!csrfToken) {
    throw new Error("Missing CSRF token");
  }

  const optionsResponse = await fetch(
    `/api/auth/webauthn-options/passkey?${new URLSearchParams({
      action: "register",
    })}`,
    { credentials: "include" },
  );

  if (!optionsResponse.ok) {
    throw new Error("Could not start passkey registration");
  }

  const optionsBody = (await optionsResponse.json()) as {
    action: "register" | "authenticate";
    options: Parameters<typeof startRegistration>[0];
  };

  if (optionsBody.action !== "register") {
    throw new Error("Unexpected WebAuthn action");
  }

  const features = await readWebAuthnClientFeatures();
  const hints = resolveRegistrationHints(features);
  const registrationOptions = hints
    ? ({ ...optionsBody.options, hints } as Parameters<
        typeof startRegistration
      >[0])
    : optionsBody.options;
  const registrationResponse = await startRegistration(registrationOptions);

  const callbackResponse = await fetch("/api/auth/callback/passkey", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    credentials: "include",
    body: new URLSearchParams({
      csrfToken,
      action: "register",
      data: JSON.stringify(registrationResponse),
      callbackUrl: window.location.href,
    }),
  });

  const callbackData = (await callbackResponse.json()) as { url?: string };
  const callbackUrl = callbackData.url ?? "";
  if (!callbackResponse.ok || callbackUrl.includes("error=")) {
    throw new Error("Registration failed");
  }

  return {
    credentialID: registrationResponse.id,
    attestationObject: registrationResponse.response.attestationObject,
  };
}
