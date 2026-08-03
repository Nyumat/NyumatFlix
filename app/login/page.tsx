import { signIn } from "@/auth";
import { FloatingCapLoginForm } from "@/components/auth/floating-cap-login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCapApiEndpoint } from "@/lib/cap/config";
import { withCapVerifiedSignIn } from "@/lib/cap/auth-authorization";
import { verifyCapToken } from "@/lib/cap/server";
import { getDevMagicLink } from "@/lib/dev-magic-link-store";
import { SITE_URL } from "@/lib/constants";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/seo/constants";
import { Mail } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSiteFlags } from "@/lib/flags/site-flags";
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

export default async function LoginPage() {
  const flags = await getSiteFlags();
  if (!flags.authEnabled) {
    redirect("/");
  }

  const handleLogin = async (formData: FormData) => {
    "use server";

    const email = formData.get("email") as string;
    const capToken = formData.get("cap-token");

    if (!email || !(await verifyCapToken(capToken))) {
      redirect("/login/error?error=Captcha");
      return;
    }

    try {
      await withCapVerifiedSignIn(() =>
        signIn("resend", {
          email,
          redirect: false,
        }),
      );
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }

    if (process.env.NODE_ENV === "development") {
      const magicLink = getDevMagicLink(email);
      if (magicLink) {
        redirect(`/login/verify?devLink=${encodeURIComponent(magicLink)}`);
      }
    }

    redirect("/login/verify");
  };

  return (
    <AuthShell
      eyebrow="Sign in to keep everything synced."
      title="Make NyumatFlix yours."
      description="Unlock watchlists, progress, and direct feature requests."
    >
      <Card className="overflow-hidden rounded-2xl border-white/12 bg-zinc-950/72 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <CardHeader className="space-y-3 px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
          <div className="flex size-11 items-center justify-center rounded-xl border border-sky-300/15 bg-sky-300/10 text-sky-200">
            <Mail className="size-5" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold leading-tight tracking-tight text-white">
              Sign in
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-zinc-400">
              Enter your email and we will send a magic link to login.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
          <FloatingCapLoginForm
            action={handleLogin}
            endpoint={getCapApiEndpoint()}
          />
          <p className="mt-5 text-center text-xs leading-5 text-zinc-500">
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
