import {
  convertAAGUIDToString,
  decodeAttestationObject,
  isoBase64URL,
  parseAuthenticatorData,
} from "@simplewebauthn/server/helpers";
import { normalizeAaguid } from "@/lib/passkeys/aaguid-inventory";

export function extractAaguidFromAttestation(
  attestationObject: string,
): string | null {
  try {
    const attestation = decodeAttestationObject(
      isoBase64URL.toBuffer(attestationObject),
    );
    const authData = parseAuthenticatorData(attestation.get("authData"));
    if (!authData.aaguid) return null;
    return normalizeAaguid(convertAAGUIDToString(authData.aaguid));
  } catch {
    return null;
  }
}
