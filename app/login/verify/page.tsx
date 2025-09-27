import { ArrowLeft, MailCheck } from "lucide-react";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NeuralNetworkBackground } from "../neural-network-client";

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

export default function VerifyRequestPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div
          className="w-screen h-screen flex flex-col relative opacity-30"
          suppressHydrationWarning
        >
          <NeuralNetworkBackground />
        </div>
      </div>
      <div className="relative z-20 my-16 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <Link href="/" className="inline-block">
              <Image
                src="/logo.svg"
                alt="NyumatFlix Logo"
                width={80}
                height={80}
                className="mx-auto"
              />
            </Link>
            <div>
              <h1 className="text-3xl font-light text-foreground">
                <span className="font-medium">NyumatFlix</span>
              </h1>
            </div>
          </div>
          <div className="relative">
            <Card className="bg-card/80 backdrop-blur-md border-border/50 shadow-2xl">
              <CardHeader className="space-y-4 text-center pb-4">
                <div>
                  <CardTitle className="text-2xl font-medium text-foreground">
                    Check your email
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <div className="p-6 bg-muted/30 rounded-lg border border-border/50">
                  <div className="w-12 h-12 bg-gradient-to-r from-primary/20 to-fuchsia-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MailCheck className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm text-foreground font-medium mb-2">
                    The magic link has been sent to your email.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-light">
                    Didn't receive an email? Try checking your spam folder.
                  </p>

                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary/80"
                  >
                    <Link href="/login">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to sign in
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-light">
              Having trouble?{" "}
              <Link
                href="https://github.com/Nyumat/NyumatFlix"
                target="_blank"
                className="text-primary hover:underline"
              >
                Open an issue on GitHub.
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
