import { PageContainer } from "@/components/layout/page-container";

export default function TVShowPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <main>{children}</main>
    </PageContainer>
  );
}

// This file has been simplified to not render any hero by default
