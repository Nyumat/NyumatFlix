import { PageContainer } from "@/components/layout/page-container";

export default function TVShowPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer className="bg-transparent">
      <main>{children}</main>
    </PageContainer>
  );
}
