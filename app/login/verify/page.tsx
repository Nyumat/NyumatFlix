import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, MailCheck } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../auth-shell";

type VerifyRequestPageProps = {
  searchParams: Promise<{ devLink?: string }>;
};

export const metadata: Metadata = {
  title: "Verify Email | NyumatFlix",
  description: "Check your email for the magic link to sign in to NyumatFlix",
  keywords: ["NyumatFlix", "Verify Email", "Magic Link", "Authentication"],
  openGraph: {
    type: "website",
    url: "https://nyumatflix.com/login/verify",
    title: "Verify Email | NyumatFlix",
    description: "Check your email for the magic link to sign in to NyumatFlix",
    images: [
      {
        url: "https://nyumatflix.com/og.webp",
        alt: "Verify Email | NyumatFlix",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com/login/verify",
    title: "Verify Email | NyumatFlix",
    description: "Check your email for the magic link to sign in to NyumatFlix",
    images: [
      {
        url: "https://nyumatflix.com/og.webp",
        alt: "Verify Email | NyumatFlix",
      },
    ],
  },
};

export default async function VerifyRequestPage({
  searchParams,
}: VerifyRequestPageProps) {
  const { devLink } = await searchParams;

  return (
    <AuthShell
      eyebrow="One last thing."
      title="Check your email to finish signing in."
      description="The link takes you right back here."
    >
      <Card className="overflow-hidden rounded-2xl border-white/12 bg-zinc-950/72 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <CardHeader className="space-y-3 px-6 pb-4 pt-6 text-center sm:px-8 sm:pt-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-sky-300/15 bg-sky-300/10 text-sky-200">
            <MailCheck className="size-6" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold leading-tight tracking-tight text-white">
              Check your email
            </CardTitle>
            <p className="text-sm leading-6 text-zinc-400">
              We sent a secure magic link. It can take a minute to arrive.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6 pt-2 text-center sm:px-8 sm:pb-8">
          <div className="rounded-2xl border border-white/10 bg-black/28 p-5">
            {devLink ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-zinc-200">
                  Development mode detected. Use the generated link below to
                  finish signing in.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="h-11 rounded-xl border-sky-300/20 bg-sky-300/15 px-5 text-sm font-semibold text-sky-50 shadow-none hover:border-sky-300/35 hover:bg-sky-300/22"
                >
                  <a href={devLink}>
                    <ExternalLink className="mr-2 size-4" />
                    Open magic link
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-100">
                  The magic link has been sent to your email.
                </p>
                <p className="text-xs leading-5 text-zinc-500">
                  If it is not in your inbox, check spam or promotions before
                  requesting another link.
                </p>
              </div>
            )}
          </div>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-10 rounded-xl px-4 text-zinc-300 shadow-none hover:bg-white/8 hover:text-white"
          >
            <Link href="/login">
              <ArrowLeft className="mr-2 size-4" />
              Back to sign in
            </Link>
          </Button>

          <p className="text-xs leading-5 text-zinc-500">
            Having trouble?{" "}
            <Link
              href="https://github.com/Nyumat/NyumatFlix"
              target="_blank"
              className="font-medium text-zinc-300 underline-offset-4 hover:text-white hover:underline"
            >
              Open an issue on GitHub
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
