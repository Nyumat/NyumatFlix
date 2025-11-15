import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { accounts, db, sessions, users, verificationTokens } from "@/db/schema";
import { html, text } from "@/emails/email-helpers";
import {
  MAGIC_LINK_RESEND_FROM,
  MAGIC_LINK_RESEND_SUBJECT,
} from "@/lib/constants";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: MAGIC_LINK_RESEND_FROM,
      sendVerificationRequest: async ({ identifier, url, provider, theme }) => {
        // In development, log the magic link to console instead of sending email
        if (process.env.NODE_ENV === "development") {
          console.log("\n" + "=".repeat(60));
          console.log("🔐 MAGIC LINK FOR DEVELOPMENT");
          console.log("=".repeat(60));
          console.log(`📧 Email: ${identifier}`);
          console.log(`🔗 Magic Link: ${url}`);
          console.log("=".repeat(60));
          console.log("⚠️  Development mode: Email not sent. Use the link above to sign in.");
          console.log("=".repeat(60) + "\n");
          return;
        }

        // Production: Send actual email via Resend
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
    session: async ({ session, token }) => {
      if (session?.user && token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    jwt: async ({ user, token }) => {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
  },
  debug: process.env.NODE_ENV === "development",
});
