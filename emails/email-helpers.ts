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
  return `Sign in to Nyumatflix

Click the button below to sign in to your account.

${url}

This link expires in 24 hours and can only be used once.`;
};
