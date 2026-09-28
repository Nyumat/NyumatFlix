import {
  accounts,
  authenticators,
  db,
  sessions,
  users,
  verificationTokens,
} from "@/db";
import { html, text } from "@/emails/email-helpers";
import {
  MAGIC_LINK_RESEND_FROM,
  MAGIC_LINK_RESEND_SUBJECT,
} from "@/lib/constants";
import { setDevMagicLink } from "@/lib/dev-magic-link-store";
import { isCapVerifiedSignIn } from "@/lib/cap/auth-authorization";
import {
  applyAuthDbProfileToJwt,
  applyAuthSessionUpdateToJwt,
  applyAuthUserToJwt,
  shouldRefreshAuthJwtFromDatabase,
} from "@/lib/auth/jwt-profile";
import { getSiteFlags } from "@/lib/flags/site-flags-server";
import { arePasskeysEnabled } from "@/lib/passkeys/passkeys-enabled";
import { applyPendingPasskeyMetadata } from "@/lib/passkeys/apply-registration-metadata";
import { getPasskeyRelayingParty } from "@/lib/passkeys/auth-relaying-party";
import { resolveWebAuthnRelayingParty } from "@/lib/passkeys/rp-config";
import {
  generatePasskeyAuthenticationOptions,
  generatePasskeyRegistrationOptions,
  verifyPasskeyAuthenticationResponse,
  verifyPasskeyRegistrationResponse,
} from "@/lib/passkeys/simplewebauthn-server";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import Passkey from "next-auth/providers/passkey";
import { eq } from "drizzle-orm";

const passkeyRelayingParty = resolveWebAuthnRelayingParty();

const PASSKEY_ENROLLMENT_TTL_MS = 5 * 60 * 1000;

const shouldRefreshPasskeyEnrollment = (
  token: {
    uid?: string;
    email?: string | null;
    passkeyCheckedAt?: number;
  },
  trigger?: string,
): boolean => {
  if (typeof token.uid !== "string" || !token.email) {
    return false;
  }
  if (trigger === "signIn" || trigger === "signUp") {
    return true;
  }
  if (token.passkeyCheckedAt === undefined) {
    return true;
  }
  return Date.now() - token.passkeyCheckedAt > PASSKEY_ENROLLMENT_TTL_MS;
};

const resolveRequiresPasskey = async (
  userId: string,
  emailPasskeyEnrollmentRequired: boolean,
  passkeysEnabled: boolean,
): Promise<boolean> => {
  if (!passkeysEnabled) {
    return false;
  }
  const [passkey] = await db
    .select({ credentialID: authenticators.credentialID })
    .from(authenticators)
    .where(eq(authenticators.userId, userId))
    .limit(1);
  return emailPasskeyEnrollmentRequired || !passkey;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  // Keep sessions in JWT cookies. The adapter stores users, email tokens,
  // and passkeys; session reads check passkey enrollment in the database.
  session: { strategy: "jwt" },
  experimental: { enableWebAuthn: true },
  providers: [
    Passkey({
      // New accounts must verify their email first. Signed-in users are
      // resolved by Auth.js before this callback and can register normally.
      getUserInfo: async () => null,
      enableConditionalUI: false,
      getRelayingParty: getPasskeyRelayingParty,
      relayingParty: {
        id: passkeyRelayingParty.id,
        name: passkeyRelayingParty.name,
        origin: passkeyRelayingParty.origin,
      },
      simpleWebAuthn: {
        generateAuthenticationOptions: generatePasskeyAuthenticationOptions,
        generateRegistrationOptions: generatePasskeyRegistrationOptions,
        verifyAuthenticationResponse: verifyPasskeyAuthenticationResponse,
        verifyRegistrationResponse: verifyPasskeyRegistrationResponse,
      },
      registrationOptions: {
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
      },
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: MAGIC_LINK_RESEND_FROM,
      sendVerificationRequest: async ({ identifier, url, provider, theme }) => {
        if (!isCapVerifiedSignIn()) {
          throw new Error(
            "Human verification is required before sending email",
          );
        }

        if (process.env.NODE_ENV === "development") {
          console.log("\n" + "=".repeat(60));
          console.log("🔐 MAGIC LINK FOR DEVELOPMENT");
          console.log("=".repeat(60));
          console.log(`📧 Email: ${identifier}`);
          console.log(`🔗 Magic Link: ${url}`);
          console.log("=".repeat(60) + "\n");
          setDevMagicLink(identifier, url);
          return;
        }
        const { host } = new URL(url);
        const flags = await getSiteFlags();
        const passkeysEnabled = arePasskeysEnabled(flags);
        const emailHtml = await html({ url, host, theme, passkeysEnabled });
        const emailText = text({ url, host, passkeysEnabled });
        const subject = MAGIC_LINK_RESEND_SUBJECT;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: identifier,
            subject,
            html: emailHtml,
            text: emailText,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error("Resend API Error:", {
            status: res.status,
            statusText: res.statusText,
            error: errorData,
          });
          throw new Error(
            `Failed to send verification request: ${res.status} ${res.statusText} - ${JSON.stringify(errorData)}`,
          );
        }
      },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account }) => {
      const flags = await getSiteFlags();
      if (!flags.authEnabled) {
        return false;
      }
      if (account?.provider === "passkey" && !arePasskeysEnabled(flags)) {
        return false;
      }
      if (flags.signupDisabled && user.email) {
        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);
        if (!existing) {
          return false;
        }
      }
      return true;
    },
    jwt: async ({ token, user, account, trigger, session }) => {
      if (account) {
        token.emailPasskeyEnrollmentRequired = account.provider === "resend";
      }
      if (user) {
        token = applyAuthUserToJwt(token, user);
      }

      if (trigger === "update" && session) {
        token = applyAuthSessionUpdateToJwt(token, session);
      }

      if (shouldRefreshAuthJwtFromDatabase(token, trigger)) {
        const uid = token.uid;
        if (typeof uid !== "string") {
          return token;
        }

        const [dbUser] = await db
          .select({
            name: users.name,
            image: users.image,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, uid))
          .limit(1);

        if (dbUser) {
          token = applyAuthDbProfileToJwt(token, dbUser);
        } else {
          token.profileHydrated = true;
        }
      }

      if (shouldRefreshPasskeyEnrollment(token, trigger)) {
        const uid = token.uid;
        const flags = await getSiteFlags();
        const passkeysEnabled = arePasskeysEnabled(flags);
        if (typeof uid === "string" && token.email) {
          token.requiresPasskey = await resolveRequiresPasskey(
            uid,
            token.emailPasskeyEnrollmentRequired === true,
            passkeysEnabled,
          );
          token.passkeyCheckedAt = Date.now();
        } else if (!passkeysEnabled) {
          token.requiresPasskey = false;
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session?.user && typeof token.uid === "string") {
        session.user.id = token.uid;
        // Check the database rather than trusting a client session update or
        // a stale JWT after a passkey is removed on another device.
        const flags = await getSiteFlags();
        if (token.email && arePasskeysEnabled(flags)) {
          session.user.requiresPasskey = token.requiresPasskey === true;
        } else {
          session.user.requiresPasskey = false;
        }
        if (typeof token.name === "string") {
          session.user.name = token.name;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        if (typeof token.picture === "string") {
          session.user.image = token.picture;
        }
      }

      return session;
    },
    redirect: async ({ url, baseUrl }) => {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) {
          return url;
        }
      } catch {
        // Fall through to the app root.
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login/error",
    verifyRequest: "/login/verify",
  },
  events: {
    signIn: async ({ account, user }) => {
      if (
        account?.provider !== "passkey" ||
        !user.id ||
        !account.providerAccountId
      ) {
        return;
      }
      await applyPendingPasskeyMetadata(account.providerAccountId, user.id);
    },
  },
});
