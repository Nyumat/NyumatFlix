// import { HeaderHero } from "@/components/hero"; // Removed for search page
import { PageContainer } from "@/components/layout/page-container";

export default function SearchPageLayout({
  // Renamed from MoviePageLayout for clarity
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      {/* <HeaderHero title="Search" imageUrl={`/search-hero3.svg`} /> */}
      {/* The HeaderHero is removed to allow the search page to define its own header/title structure */}
      <main>{children}</main>
    </PageContainer>
  );
}
