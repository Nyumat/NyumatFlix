import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  GenerateAuthenticationOptionsOpts,
  GenerateRegistrationOptionsOpts,
  VerifyAuthenticationResponseOpts,
  VerifyRegistrationResponseOpts,
} from "@simplewebauthn/server";
import { normalizeAaguid } from "@/lib/passkeys/aaguid-inventory";
import {
  stashRegistrationChallenge,
  stashRegistrationMetadata,
  takeRegistrationMetadataForChallenge,
} from "@/lib/passkeys/pending-registration-metadata";
import {
  encodeWebAuthnUserHandle,
  getOrCreateWebAuthnUserHandleForEmail,
} from "@/lib/passkeys/webauthn-user-handle";

export async function generatePasskeyRegistrationOptions(
  options: GenerateRegistrationOptionsOpts,
) {
  const stableHandle = options.userName
    ? await getOrCreateWebAuthnUserHandleForEmail(options.userName)
    : null;

  const userID = (stableHandle ??
    options.userID) as GenerateRegistrationOptionsOpts["userID"];

  const registrationOptions = await generateRegistrationOptions({
    ...options,
    userID,
    attestationType: options.attestationType ?? "none",
    extensions: {
      credProps: true,
      ...options.extensions,
    },
  });

  if (stableHandle) {
    stashRegistrationChallenge(registrationOptions.challenge, {
      aaguid: null,
      webauthnUserId: encodeWebAuthnUserHandle(stableHandle),
    });
  }

  return registrationOptions;
}

export async function generatePasskeyAuthenticationOptions(
  options?: GenerateAuthenticationOptionsOpts,
) {
  return generateAuthenticationOptions({
    ...options,
    userVerification: options?.userVerification ?? "required",
  });
}

export async function verifyPasskeyRegistrationResponse(
  options: VerifyRegistrationResponseOpts,
) {
  const verification = await verifyRegistrationResponse(options);
  if (!verification.verified || !verification.registrationInfo) {
    return verification;
  }

  const credentialIdBase64 = Buffer.from(
    verification.registrationInfo.credentialID,
  ).toString("base64");

  const aaguid = verification.registrationInfo.aaguid
    ? normalizeAaguid(verification.registrationInfo.aaguid)
    : null;

  const challengeMetadata = takeChallengeMetadata(options.expectedChallenge);
  const responseUserHandle = readRegistrationUserHandle(options.response);

  const webauthnUserId =
    challengeMetadata?.webauthnUserId ?? responseUserHandle;
  if (webauthnUserId) {
    stashRegistrationMetadata(credentialIdBase64, {
      aaguid,
      webauthnUserId,
    });
  }

  return verification;
}

export async function verifyPasskeyAuthenticationResponse(
  options: VerifyAuthenticationResponseOpts,
) {
  return verifyAuthenticationResponse(options);
}

function takeChallengeMetadata(
  challenge: VerifyRegistrationResponseOpts["expectedChallenge"],
) {
  if (typeof challenge === "function") return null;
  const key = Array.isArray(challenge) ? challenge[0] : challenge;
  if (!key) return null;
  return takeRegistrationMetadataForChallenge(key);
}

function readRegistrationUserHandle(
  response: VerifyRegistrationResponseOpts["response"],
): string | null {
  const userHandle = (response.response as { userHandle?: string }).userHandle;
  if (!userHandle) return null;

  try {
    return Buffer.from(userHandle, "base64url").toString("base64");
  } catch {
    try {
      return Buffer.from(userHandle, "base64").toString("base64");
    } catch {
      return null;
    }
  }
}
