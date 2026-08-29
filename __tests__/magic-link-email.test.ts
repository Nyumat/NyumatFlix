import { html, text } from "@/emails/email-helpers";
import {
  MAGIC_LINK_RESEND_FROM,
  MAGIC_LINK_RESEND_SUBJECT,
} from "@/lib/constants";
import { describe, expect, it } from "vitest";

const url =
  "https://nyumatflix.com/api/auth/callback/resend?token=example-token";

describe("magic link email", () => {
  it("renders a plain html email with the sign-in url and no images", async () => {
    const markup = await html({ url, host: "nyumatflix.com" });

    expect(markup).toContain("Sign in to NyumatFlix");
    expect(markup).toContain(url);
    expect(markup).not.toMatch(/<img\b/i);
    expect(markup).not.toMatch(/linear-gradient/i);
    expect(markup).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("includes a matching plain-text body", () => {
    const body = text({ url, host: "nyumatflix.com" });

    expect(body).toContain("Sign in to NyumatFlix");
    expect(body).toContain(url);
    expect(body).toContain("If you did not request this email");
  });

  it("uses a recognizable from address and subject", () => {
    expect(MAGIC_LINK_RESEND_SUBJECT).toBe("Sign in to NyumatFlix");
    expect(MAGIC_LINK_RESEND_FROM).toMatch(/NyumatFlix </);
    expect(MAGIC_LINK_RESEND_FROM).not.toContain("login@auth.nyumatflix.com");
  });
});
