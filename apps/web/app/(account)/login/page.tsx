import { auth, signIn } from "@/auth";
import { CapLoginForm } from "@/components/auth/cap-login-form";
import { LoginMethodHeader } from "@/components/auth/login-method-header";
import { MalLoginButton } from "@/components/auth/mal-login-button";
import { Card, CardContent } from "@/components/ui/card";
import { getCapApiEndpoint } from "@/lib/cap/config";
import { withCapVerifiedSignIn } from "@/lib/cap/auth-authorization";
import { isCapDevBypassEnabled } from "@/lib/cap/constants";
import { verifyCapToken } from "@/lib/cap/server";
import { getDevMagicLink } from "@/lib/dev-magic-link-store";
import { SITE_URL } from "@/lib/constants";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/seo/constants";
import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSiteFlags } from "@/lib/flags/site-flags-server";
import {
  loginErrorHref,
  loginVerifyHref,
  safeAuthCallbackPath,
} from "@/lib/auth/callback-url";
import { AuthShell } from "./auth-shell";

export const metadata: Metadata = {
  title: "Login | NyumatFlix",
  description: "Login to NyumatFlix | Access Your Watchlist & More",
  keywords: [
    "NyumatFlix",
    "Login",
    "Sign In",
    "Authentication",
    "Movies",
    "TV Shows",
    "Watchlist",
    "Streaming",
    "Entertainment",
  ],
  openGraph: {
    type: "website",
    url: `${SITE_URL}/login`,
    title: "Login | NyumatFlix",
    description: "Login to NyumatFlix | Access Your Watchlist & More",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        type: DEFAULT_OG_IMAGE_TYPE,
        alt: "Login | NyumatFlix",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: `${SITE_URL}/login`,
    title: "Login | NyumatFlix",
    description: "Login to NyumatFlix | Access Your Watchlist & More",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        alt: "Login | NyumatFlix",
      },
    ],
  },
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage(props: LoginPageProps) {
  const searchParams = await props.searchParams;
  const [flags, session, params] = await Promise.all([
    getSiteFlags(),
    auth(),
    searchParams,
  ]);
  const callbackUrl = safeAuthCallbackPath(params.callbackUrl);
  if (!flags.authEnabled) {
    redirect("/");
  }
  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  const handleLogin = async (formData: FormData) => {
    "use server";

    const email = formData.get("email") as string;
    const capToken = formData.get("cap-token");

    if (
      !email ||
      (!isCapDevBypassEnabled() && !(await verifyCapToken(capToken)))
    ) {
      redirect(loginErrorHref("Captcha", callbackUrl));
      return;
    }

    try {
      await withCapVerifiedSignIn(() =>
        signIn("resend", {
          email,
          redirect: false,
          redirectTo: callbackUrl,
        }),
      );
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }

    if (process.env.NODE_ENV === "development") {
      const magicLink = getDevMagicLink(email);
      if (magicLink) {
        // Server actions can't redirect() to a route handler directly: the
        // client router fetches it, follows the 302 internally, and renders
        // the result under the callback URL. The verify page performs a full
        // browser navigation to the magic link instead.
        redirect(
          loginVerifyHref({
            callbackUrl,
            devLink: magicLink,
          }),
        );
      }
    }

    redirect(loginVerifyHref({ callbackUrl }));
  };

  return (
    <AuthShell
      eyebrow="Create an account to keep everything synced."
      title="Make NyumatFlix yours."
      description="Unlock watchlists, progress, and direct feature requests."
    >
      <Card className="overflow-hidden rounded-2xl border-white/12 bg-zinc-950/82 text-white shadow-[0_28px_90px_rgba(0,0,0,0.58)] backdrop-blur-xl">
        <LoginMethodHeader signupDisabled={flags.signupDisabled} />
        <CardContent className="px-6 pb-7 sm:px-8 sm:pb-8">
          <CapLoginForm
            action={handleLogin}
            endpoint={getCapApiEndpoint()}
            callbackUrl={callbackUrl}
          />
          {process.env.MAL_CLIENT_ID ? (
            <div className="mt-4">
              <MalLoginButton callbackUrl={callbackUrl} helperText={null} />
            </div>
          ) : null}
          <p className="mt-6 text-center text-xs leading-5 text-zinc-600">
            By continuing, you agree to the{" "}
            <Link
              href="/terms"
              className="font-medium text-zinc-300 underline-offset-4 hover:text-white hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-medium text-zinc-300 underline-offset-4 hover:text-white hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
