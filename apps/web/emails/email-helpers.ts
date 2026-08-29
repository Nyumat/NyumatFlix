import { SITE_NAME } from "@/lib/constants";
import { render } from "@react-email/render";
import MagicLinkEmail from "./magic-link";

interface EmailParams {
  url: string;
  host: string;
  theme?: {
    brandColor?: string;
    buttonText?: string;
  };
}

export const html = async ({
  url,
  host,
  theme: _theme,
}: EmailParams): Promise<string> => {
  return await render(MagicLinkEmail({ url, host }));
};

export const text = ({ url, host: _host }: EmailParams): string => {
  return `Sign in to ${SITE_NAME}

Use this link to sign in. It expires in 24 hours and can only be used once.

${url}

If you did not request this email, you can ignore it.`;
};
