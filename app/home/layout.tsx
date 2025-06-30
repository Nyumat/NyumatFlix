import { PageContainer } from "@/components/layout/page-container";

export default function HomePageLayout({
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
