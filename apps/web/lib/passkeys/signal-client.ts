import type { PasskeySignalPayload } from "@/lib/passkeys/signal-payload";

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

const getSignalCredential = (): SignalCredentialStatic | null => {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return null;
  }
  return window.PublicKeyCredential as unknown as SignalCredentialStatic;
};

export async function syncPasskeySignals(
  payload: PasskeySignalPayload,
): Promise<void> {
  const signalCredential = getSignalCredential();
  if (!signalCredential) return;

  for (const group of payload.groups) {
    if (signalCredential.signalAllAcceptedCredentials) {
      await signalCredential
        .signalAllAcceptedCredentials({
          rpId: payload.rpId,
          userId: group.userId,
          allAcceptedCredentialIds: group.allAcceptedCredentialIds,
        })
        .catch(() => undefined);
    }

    if (signalCredential.signalCurrentUserDetails) {
      await signalCredential
        .signalCurrentUserDetails({
          rpId: payload.rpId,
          userId: group.userId,
          name: payload.userName,
          displayName: payload.displayName,
        })
        .catch(() => undefined);
    }
  }
}

export async function signalUnknownPasskeyCredential(input: {
  rpId: string;
  credentialId: string;
}): Promise<void> {
  const signalCredential = getSignalCredential();
  if (!signalCredential?.signalUnknownCredential) return;

  await signalCredential
    .signalUnknownCredential({
      rpId: input.rpId,
      credentialId: input.credentialId,
    })
    .catch(() => undefined);
}
