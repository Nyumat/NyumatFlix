import { html } from "@/emails/email-helpers";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const markup = await html({
    url: `${origin}/api/auth/callback/resend?token=preview-token`,
    host: new URL(origin).host,
  });

  return new Response(markup, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
