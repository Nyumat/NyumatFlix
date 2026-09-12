import { PageContainer } from "@/components/layout/page-container";

export default function MoviePageLayout({
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
