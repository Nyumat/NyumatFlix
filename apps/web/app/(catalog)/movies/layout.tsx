import { PageContainer } from "@/components/layout/page-container";

export default function MoviePageLayout({
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
