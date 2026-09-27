import { SITE_NAME } from "@/lib/constants";
import { render } from "@react-email/render";
import MagicLinkEmail from "./magic-link";

interface EmailParams {
  url: string;
  host: string;
  passkeysEnabled?: boolean;
  theme?: {
    brandColor?: string;
    buttonText?: string;
  };
}

export const html = async ({
  url,
  host,
  passkeysEnabled = false,
  theme: _theme,
}: EmailParams): Promise<string> => {
  return await render(MagicLinkEmail({ url, host, passkeysEnabled }));
};

export const text = ({
  url,
  host: _host,
  passkeysEnabled = false,
}: EmailParams): string => {
  const passkeyLine = passkeysEnabled
    ? " After signing in, add a passkey for your next visit."
    : "";

  return `Sign in to ${SITE_NAME}

Use this link to sign in. It expires in 24 hours and can only be used once.${passkeyLine}

${url}

If you did not request this email, you can ignore it.`;
};
