export type WebAuthnClientCapabilities = Partial<
  Record<
    | "conditionalCreate"
    | "conditionalGet"
    | "hybridTransport"
    | "passkeyPlatformAuthenticator"
    | "relatedOrigins"
    | "signalAllAcceptedCredentials"
    | "signalCurrentUserDetails"
    | "signalUnknownCredential"
    | "userVerifyingPlatformAuthenticator",
    boolean
  >
>;

export type PublicKeyCredentialHint =
  | "security-key"
  | "client-device"
  | "hybrid";

export type WebAuthnClientFeatureSupport = {
  webauthn: boolean;
  conditionalAutofill: boolean;
  capabilities: WebAuthnClientCapabilities | null;
  signal: {
    allAcceptedCredentials: boolean;
    currentUserDetails: boolean;
    unknownCredential: boolean;
  };
  hints: boolean;
};

type SignalCredentialStatic = {
  signalAllAcceptedCredentials?: (input: {
    rpId: string;
    userId: string;
    allAcceptedCredentialIds: string[];
  }) => Promise<void>;
  signalCurrentUserDetails?: (input: {
    rpId: string;
    userId: string;
    name: string;
    displayName: string;
  }) => Promise<void>;
  signalUnknownCredential?: (input: {
    rpId: string;
    credentialId: string;
  }) => Promise<void>;
};

export async function readWebAuthnClientFeatures(): Promise<WebAuthnClientFeatureSupport> {
  if (
    typeof window === "undefined" ||
    !window.PublicKeyCredential ||
    typeof window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable !== "function"
  ) {
    return {
      webauthn: false,
      conditionalAutofill: false,
      capabilities: null,
      signal: {
        allAcceptedCredentials: false,
        currentUserDetails: false,
        unknownCredential: false,
      },
      hints: false,
    };
  }

  const signalCredential =
    window.PublicKeyCredential as unknown as SignalCredentialStatic;

  let capabilities: WebAuthnClientCapabilities | null = null;
  if (
    "getClientCapabilities" in window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.getClientCapabilities === "function"
  ) {
    try {
      capabilities = await window.PublicKeyCredential.getClientCapabilities();
    } catch {
      capabilities = null;
    }
  }

  let conditionalAutofill = false;
  try {
    const { browserSupportsWebAuthnAutofill } = await import(
      "@simplewebauthn/browser"
    );
    conditionalAutofill = await browserSupportsWebAuthnAutofill();
  } catch {
    conditionalAutofill = false;
  }

  const signal = {
    allAcceptedCredentials:
      capabilities?.signalAllAcceptedCredentials === true ||
      typeof signalCredential.signalAllAcceptedCredentials === "function",
    currentUserDetails:
      capabilities?.signalCurrentUserDetails === true ||
      typeof signalCredential.signalCurrentUserDetails === "function",
    unknownCredential:
      capabilities?.signalUnknownCredential === true ||
      typeof signalCredential.signalUnknownCredential === "function",
  };

  return {
    webauthn: true,
    conditionalAutofill,
    capabilities,
    signal,
    hints: typeof capabilities?.hybridTransport === "boolean",
  };
}

export function resolveAuthenticationHints(
  features: WebAuthnClientFeatureSupport,
): PublicKeyCredentialHint[] | undefined {
  if (!features.hints) return undefined;
  if (features.capabilities?.passkeyPlatformAuthenticator) {
    return ["client-device", "hybrid"];
  }
  return ["client-device", "security-key", "hybrid"];
}

export function resolveRegistrationHints(
  features: WebAuthnClientFeatureSupport,
): PublicKeyCredentialHint[] | undefined {
  return resolveAuthenticationHints(features);
}
