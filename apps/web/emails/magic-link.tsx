import { SITE_NAME } from "@/lib/constants";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

interface MagicLinkEmailProps {
  url: string;
  host: string;
}

export const MagicLinkEmail = ({ url, host: _host }: MagicLinkEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Sign in to {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>{SITE_NAME}</Text>
          <Heading style={heading}>Sign in</Heading>
          <Text style={copy}>
            Use this link to sign in. It expires in 24 hours and can only be
            used once.
          </Text>
          <Text style={copy}>
            <Link href={url} style={signInLink}>
              Sign in to {SITE_NAME}
            </Link>
          </Text>
          <Text style={muted}>
            If you did not request this email, you can ignore it.
          </Text>
          <Text style={urlFallback}>{url}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export default MagicLinkEmail;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  margin: "0 auto",
  maxWidth: "480px",
  padding: "32px 24px",
};

const brand = {
  color: "#111111",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 24px 0",
};

const heading = {
  color: "#111111",
  fontSize: "20px",
  fontWeight: "600",
  margin: "0 0 16px 0",
};

const copy = {
  color: "#333333",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px 0",
};

const signInLink = {
  color: "#111111",
  fontWeight: "600",
  textDecoration: "underline",
};

const muted = {
  color: "#666666",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "24px 0 16px 0",
};

const urlFallback = {
  color: "#999999",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
  wordBreak: "break-all" as const,
};
