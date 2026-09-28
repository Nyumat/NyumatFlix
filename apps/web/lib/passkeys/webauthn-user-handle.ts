import { db, users } from "@/db";
import { eq } from "drizzle-orm";

const WEBAUTHN_USER_HANDLE_BYTES = 32;

export function createWebAuthnUserHandleBytes(): Uint8Array {
  const bytes = new Uint8Array(WEBAUTHN_USER_HANDLE_BYTES);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function encodeWebAuthnUserHandle(handle: Uint8Array): string {
  return Buffer.from(handle).toString("base64");
}

export function decodeWebAuthnUserHandle(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, "base64"));
}

export async function getOrCreateWebAuthnUserHandleForUser(
  userId: string,
): Promise<Uint8Array> {
  const [row] = await db
    .select({ webauthnUserHandle: users.webauthnUserHandle })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (row?.webauthnUserHandle) {
    return decodeWebAuthnUserHandle(row.webauthnUserHandle);
  }

  const handle = createWebAuthnUserHandleBytes();
  await db
    .update(users)
    .set({ webauthnUserHandle: encodeWebAuthnUserHandle(handle) })
    .where(eq(users.id, userId));

  return handle;
}

export async function getOrCreateWebAuthnUserHandleForEmail(
  email: string,
): Promise<Uint8Array | null> {
  const [row] = await db
    .select({ id: users.id, webauthnUserHandle: users.webauthnUserHandle })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!row) return null;
  if (row.webauthnUserHandle) {
    return decodeWebAuthnUserHandle(row.webauthnUserHandle);
  }

  return getOrCreateWebAuthnUserHandleForUser(row.id);
}
