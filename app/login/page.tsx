import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDevMagicLink } from "@/lib/dev-magic-link-store";
import { ArrowRight, Mail } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
    url: "https://nyumatflix.com/login",
    title: "Login | NyumatFlix",
    description: "Login to NyumatFlix | Access Your Watchlist & More",
    images: [
      {
        url: "https://nyumatflix.com/og.webp",
        alt: "Login | NyumatFlix",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com/login",
    title: "Login | NyumatFlix",
    description: "Login to NyumatFlix | Access Your Watchlist & More",
    images: [
      {
        url: "https://nyumatflix.com/og.webp",
        alt: "Login | NyumatFlix",
      },
    ],
  },
};

export default function LoginPage() {
  const handleLogin = async (formData: FormData) => {
    "use server";

    const email = formData.get("email") as string;

    if (!email) {
      return;
    }

    try {
      await signIn("resend", {
        email,
        redirect: false,
      });
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
              Enter your email and we will send a private magic link. No
              password needed.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
          <form action={handleLogin} className="space-y-5">
            <div className="space-y-2.5">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-zinc-200"
              >
                Email address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="h-12 rounded-xl border-white/12 bg-black/35 px-4 text-base text-white shadow-none placeholder:text-zinc-600 focus-visible:ring-sky-300/80 focus-visible:ring-offset-0 dark:border-white/12 dark:bg-black/35"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full rounded-xl border-sky-300/20 bg-sky-300/15 px-5 text-sm font-semibold text-sky-50 shadow-none hover:border-sky-300/35 hover:bg-sky-300/22"
            >
              <Mail className="mr-2 size-4" />
              Continue with email
              <ArrowRight className="ml-2 size-4 transition-transform group-hover/arrow:translate-x-0.5" />
            </Button>
          </form>
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
