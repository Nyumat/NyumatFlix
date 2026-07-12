import { PageContainer } from "@/components/layout/page-container";

export default function SearchPageLayout({
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
