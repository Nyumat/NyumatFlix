import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_URL } from "@/lib/constants";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/seo/constants";
import { AlertTriangle, ArrowLeft, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../auth-shell";

type AuthErrorPageProps = {
  searchParams: Promise<{ error?: string }>;
};

type AuthErrorCopy = {
  title: string;
  description: string;
  detail: string;
};

const authErrorCopy: Record<string, AuthErrorCopy> = {
  Verification: {
    title: "This sign-in link did not work",
    description:
      "Magic links can only be used once and expire after a short time.",
    detail:
      "Request a fresh link using the same email address, then open the newest email from NyumatFlix.",
  },
  AccessDenied: {
    title: "Access denied",
    description: "We could not complete sign in for this account.",
    detail:
      "Try signing in again, or use a different email address if the issue continues.",
  },
  Configuration: {
    title: "Sign in is unavailable",
    description: "Authentication is not configured correctly right now.",
    detail:
      "Try again later. If this keeps happening, open an issue so the setup can be checked.",
  },
  Default: {
    title: "Sign in failed",
    description: "We could not complete your sign-in request.",
    detail:
      "Try requesting a new magic link. If the issue continues, the previous link may have expired or already been used.",
  },
  Signin: {
    title: "Sign in could not start",
    description: "The sign-in request could not be prepared.",
    detail: "Try again from the sign-in page and request a new magic link.",
  },
  OAuthSignin: {
    title: "Provider sign in could not start",
    description: "The external sign-in flow could not be started.",
    detail: "Try again, or use email sign in if the provider keeps failing.",
  },
  OAuthCallbackError: {
    title: "Provider sign in failed",
    description: "The external provider returned an error.",
    detail:
      "Try signing in again. If you cancelled the provider prompt, start over from the sign-in page.",
  },
  OAuthCreateAccount: {
    title: "Account could not be created",
    description: "We could not create an account from the provider response.",
    detail: "Try again, or use a different sign-in method.",
  },
  EmailCreateAccount: {
    title: "Account could not be created",
    description: "We could not create an account for that email address.",
    detail:
      "Try requesting a new magic link, or use a different email address.",
  },
  Callback: {
    title: "Sign in could not finish",
    description: "The sign-in callback did not complete.",
    detail: "Try again from the sign-in page and request a fresh link.",
  },
  OAuthAccountNotLinked: {
    title: "Use your original sign-in method",
    description: "That email is already connected to another sign-in method.",
    detail:
      "Sign in with the method you used before, then connect additional methods from your account.",
  },
  AccountNotLinked: {
    title: "Use your original sign-in method",
    description: "That email is already connected to another sign-in method.",
    detail:
      "Sign in with the method you used before, then connect additional methods from your account.",
  },
  EmailSignin: {
    title: "Email sign in failed",
    description: "We could not send or start the email sign-in flow.",
    detail:
      "Check that the email address is correct, then request a new magic link.",
  },
  EmailSignInError: {
    title: "Email sign in failed",
    description: "We could not send or start the email sign-in flow.",
    detail:
      "Check that the email address is correct, then request a new magic link.",
  },
  CredentialsSignin: {
    title: "Sign in details were not accepted",
    description: "The credentials provided were not valid.",
    detail: "Check your details and try again.",
  },
  SessionRequired: {
    title: "Sign in required",
    description: "You need to be signed in before viewing that page.",
    detail: "Sign in with your email address to continue.",
  },
  AdapterError: {
    title: "Account storage failed",
    description: "We could not read or update account data.",
    detail:
      "Try again later. If this keeps happening, the server logs need review.",
  },
  CallbackRouteError: {
    title: "Sign in could not finish",
    description: "The sign-in callback failed.",
    detail: "Try again from the sign-in page and request a fresh link.",
  },
  ErrorPageLoop: {
    title: "Error page is misconfigured",
    description: "The auth error page triggered another auth check.",
    detail:
      "This page must stay public. The server configuration should be checked.",
  },
  EventError: {
    title: "Sign in event failed",
    description: "An auth event handler failed while processing sign in.",
    detail:
      "Try again later. If this keeps happening, the server logs need review.",
  },
  InvalidCallbackUrl: {
    title: "Return link is invalid",
    description: "The sign-in request included a return URL we cannot use.",
    detail: "Start again from NyumatFlix instead of an old or copied link.",
  },
  InvalidEndpoints: {
    title: "Provider is misconfigured",
    description: "The sign-in provider endpoint settings are invalid.",
    detail:
      "Try again later. If this keeps happening, the server setup needs review.",
  },
  InvalidCheck: {
    title: "Sign in check failed",
    description: "A required security check did not pass.",
    detail:
      "Start sign in again from the same browser and avoid opening old provider tabs.",
  },
  JWTSessionError: {
    title: "Session could not be read",
    description: "Your current session token could not be verified.",
    detail: "Sign in again to create a fresh session.",
  },
  MissingAdapter: {
    title: "Account storage is not configured",
    description: "Authentication needs account storage that is not available.",
    detail: "Try again later. The server configuration needs review.",
  },
  MissingAdapterMethods: {
    title: "Account storage is incomplete",
    description: "Authentication storage is missing required behavior.",
    detail: "Try again later. The server configuration needs review.",
  },
  MissingAuthorize: {
    title: "Sign in provider is incomplete",
    description: "A credentials provider is missing its authorize handler.",
    detail: "Try again later. The server configuration needs review.",
  },
  MissingSecret: {
    title: "Sign in is not configured",
    description: "Authentication is missing its server secret.",
    detail: "Try again later. The server environment needs review.",
  },
  OAuthProfileParseError: {
    title: "Provider profile could not be read",
    description: "The provider response did not match the expected format.",
    detail: "Try again, or use email sign in if the provider keeps failing.",
  },
  SessionTokenError: {
    title: "Session could not be saved",
    description: "We could not create or update your session.",
    detail: "Try signing in again.",
  },
  OAuthSignInError: {
    title: "Provider sign in failed",
    description: "The external sign-in flow could not complete.",
    detail: "Try again, or use email sign in if the provider keeps failing.",
  },
  SignOutError: {
    title: "Sign out failed",
    description: "We could not complete sign out.",
    detail: "Refresh the page and try again.",
  },
  UnknownAction: {
    title: "Unknown auth action",
    description: "The auth request used an unsupported action.",
    detail: "Start again from the sign-in page instead of an old link.",
  },
  UnsupportedStrategy: {
    title: "Sign in strategy is unsupported",
    description: "The configured session strategy cannot support this flow.",
    detail: "Try again later. The server configuration needs review.",
  },
  InvalidProvider: {
    title: "Unknown sign-in provider",
    description: "The requested sign-in provider is not available.",
    detail: "Start again from the sign-in page and choose an available method.",
  },
  UntrustedHost: {
    title: "Host is not trusted",
    description: "The sign-in request came through an untrusted host.",
    detail: "Open NyumatFlix from its normal address and try again.",
  },
  MissingCSRF: {
    title: "Security check expired",
    description: "A required sign-in security token was missing.",
    detail: "Refresh the sign-in page and try again.",
  },
  DuplicateConditionalUI: {
    title: "Provider setup conflict",
    description: "More than one provider is configured for conditional UI.",
    detail: "Try again later. The server configuration needs review.",
  },
  MissingWebAuthnAutocomplete: {
    title: "Passkey sign in is incomplete",
    description: "The passkey sign-in form is missing required autocomplete.",
    detail: "Use email sign in for now.",
  },
  WebAuthnVerificationError: {
    title: "Passkey verification failed",
    description: "The passkey response could not be verified.",
    detail: "Try again, or use email sign in.",
  },
  ExperimentalFeatureNotEnabled: {
    title: "Feature is not enabled",
    description: "This sign-in flow needs an experimental feature flag.",
    detail: "Use email sign in for now.",
  },
  default: {
    title: "Sign in failed",
    description: "We could not complete your sign-in request.",
    detail:
      "Try requesting a new magic link. If the issue continues, the previous link may have expired or already been used.",
  },
};

export const metadata: Metadata = {
  title: "Sign In Error | NyumatFlix",
  description: "There was a problem signing in to NyumatFlix.",
  keywords: ["NyumatFlix", "Sign In Error", "Authentication", "Magic Link"],
  openGraph: {
    type: "website",
    url: `${SITE_URL}/login/error`,
    title: "Sign In Error | NyumatFlix",
    description: "There was a problem signing in to NyumatFlix.",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        type: DEFAULT_OG_IMAGE_TYPE,
        alt: "Sign In Error | NyumatFlix",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: `${SITE_URL}/login/error`,
    title: "Sign In Error | NyumatFlix",
    description: "There was a problem signing in to NyumatFlix.",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        alt: "Sign In Error | NyumatFlix",
      },
    ],
  },
};

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const { error } = await searchParams;
  const copy = error
    ? (authErrorCopy[error] ?? authErrorCopy.default)
    : authErrorCopy.default;

  return (
    <AuthShell
      eyebrow="Something interrupted sign in."
      title="Let us get you a fresh link."
      description="Your watchlist and progress are still waiting once sign in is complete."
    >
      <Card className="overflow-hidden rounded-2xl border-white/12 bg-zinc-950/72 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <CardHeader className="space-y-3 px-6 pb-4 pt-6 text-center sm:px-8 sm:pt-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold leading-tight tracking-tight text-white">
              {copy.title}
            </CardTitle>
            <p className="text-sm leading-6 text-zinc-400">
              {copy.description}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6 pt-2 text-center sm:px-8 sm:pb-8">
          <div className="rounded-2xl border border-white/10 bg-black/28 p-5">
            <p className="text-sm leading-6 text-zinc-300">{copy.detail}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-11 flex-1 rounded-xl border-sky-300/20 bg-sky-300/15 px-5 text-sm font-semibold text-sky-50 shadow-none hover:border-sky-300/35 hover:bg-sky-300/22"
            >
              <Link href="/login">
                <Mail className="mr-2 size-4" />
                Request new link
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-11 flex-1 rounded-xl px-4 text-zinc-300 shadow-none hover:bg-white/8 hover:text-white"
            >
              <Link href="/">
                <ArrowLeft className="mr-2 size-4" />
                Back home
              </Link>
            </Button>
          </div>

          <p className="text-xs leading-5 text-zinc-500">
            Error code: {error ?? "Unknown"}
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
