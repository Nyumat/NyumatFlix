import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface MagicLinkEmailProps {
  url: string;
  host: string;
}

export const MagicLinkEmail = ({ url, host: _host }: MagicLinkEmailProps) => {
  const logoSrc =
    process.env.NODE_ENV === "production"
      ? "https://nyumatflix.com/logo.webp"
      : "/static/logo.webp";

  return (
    <Html>
      <Head />
      <Preview>If you didn't request this, please ignore this email.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img
              src={logoSrc}
              width="48"
              height="48"
              alt="Nyumatflix"
              style={logo}
            />
          </Section>

          <Heading style={heading}>🪄 Your magic link</Heading>

          <Text style={linkText}>
            👉{" "}
            <Link href={url} style={magicLink}>
              Click here to sign in
            </Link>{" "}
            👈
          </Text>

          <Text style={disclaimer}>
            If you didn't request this, please ignore this email.
          </Text>

          <Section style={signatureSection}>
            <Text style={signature}>Cheers,</Text>
            <Text style={signature}>
              - The{" "}
              <Link href="https://nyumatflix.com" style={link}>
                nyumatflix.com
              </Link>{" "}
              team
            </Text>
          </Section>

          <Section style={footerSection}>
            <Img
              src={logoSrc}
              width="24"
              height="24"
              alt="Nyumatflix"
              style={footerLogo}
            />
            <Text style={footer}>
              This link expires in 24 hours and can only be used once.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default MagicLinkEmail;

const link = {
  color: "#8b5cf6",
  textDecoration: "none",
  fontWeight: "600",
};

const footerLogo = {
  display: "block",
  filter: "grayscale(100%)",
  opacity: "0.6",
  marginBottom: "12px",
};

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
  padding: "40px 20px",
  minHeight: "100vh",
};

const container = {
  backgroundColor: "#ffffff",
  background:
    "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.12) 35%, transparent 70%)",
  borderRadius: "12px",
  padding: "48px",
  maxWidth: "560px",
  margin: "0 auto",
  boxShadow:
    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
};

const logoSection = {
  marginBottom: "32px",
};

const logo = {
  display: "block",
};

const heading = {
  fontSize: "32px",
  fontWeight: "700",
  color: "#1a1a1a",
  margin: "0 0 24px 0",
};

const linkText = {
  fontSize: "18px",
  lineHeight: "28px",
  margin: "32px 0",
  color: "#374151",
};

const magicLink = {
  color: "#8b5cf6",
  textDecoration: "none",
  fontWeight: "600",
};

const disclaimer = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#6b7280",
  margin: "32px 0",
};

const signatureSection = {
  margin: "48px 0 32px 0",
};

const signature = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#374151",
  margin: "4px 0",
};

const footerSection = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: "32px",
  marginTop: "32px",
};

const footer = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#9ca3af",
  margin: "0",
};
