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
import { ArrowRight, Mail } from "lucide-react";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { NeuralNetworkBackground } from "./neural-network-client";
import { redirect } from "next/navigation";

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

      redirect("/login/verify");
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden pt-12">
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
                Welcome to NyumatFlix
              </h1>
              <p className="text-muted-foreground mt-2 font-light">
                Movies and TV Shows for everyone
              </p>
            </div>
          </div>
          <div className="relative">
            <Card className="bg-card/80 backdrop-blur-md border-border/50 shadow-2xl">
              <CardHeader className="space-y-1 text-center pb-0">
                <CardTitle className="text-xl font-medium text-foreground">
                  Sign in to NyumatFlix
                </CardTitle>
                <CardDescription className="text-muted-foreground font-light">
                  Enter your email to get started
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-sm font-medium text-foreground"
                    >
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <Button type="submit" size="lg" variant="chrome">
                    <Mail className="w-4 h-4 mr-2" />
                    Continue with Email
                    <ArrowRight className="w-4 h-4 ml-2 group-hover/arrow:translate-x-1 transition-transform" />
                  </Button>
                </form>
                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground font-light">
                    We'll send you a magic link to sign in!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-light">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
