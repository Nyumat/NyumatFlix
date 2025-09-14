import { accounts, db, sessions, users, verificationTokens } from "@/db/schema";
import { html, text } from "@/emails/email-helpers";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      from: "Nyumatflix <login@auth.nyumatflix.com>",
      sendVerificationRequest: async ({ identifier, url, provider, theme }) => {
        const { host } = new URL(url);
        const emailHtml = await html({ url, host, theme });
        const emailText = text({ url, host });
        const subject = `nyumatflix.com - Here's your magic link to sign in`;
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
          throw new Error("Failed to send verification request");
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
