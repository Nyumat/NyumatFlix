import { accounts, db, sessions, users, verificationTokens } from "@/db/schema";
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
import { getSiteFlags } from "@/lib/flags/site-flags";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // The adapter above defaults the session strategy to "database", which
  // makes every `/api/auth/session` call (every `useSession()` mount, every
  // window focus, every page load) round-trip to Postgres. Force JWT
  // sessions instead: the adapter is still needed for magic-link
  // verification tokens and user/account records, but the session itself
  // lives in a signed cookie so reads are free. See
  // https://github.com/nextauthjs/next-auth/issues/4891.
  session: { strategy: "jwt" },
  providers: [
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
        const emailHtml = await html({ url, host, theme });
        const emailText = text({ url, host });
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
    signIn: async ({ user }) => {
      const flags = await getSiteFlags();
      if (!flags.authEnabled) {
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
    jwt: async ({ token, user, trigger, session }) => {
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

      return token;
    },
    session: async ({ session, token }) => {
      if (session?.user && typeof token.uid === "string") {
        session.user.id = token.uid;
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
});
