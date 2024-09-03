import { HeaderHero } from "@/components/hero";

export default async function MoviePageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <HeaderHero title="Search" imageUrl={`/search-hero3.svg`} />
      <main className="mt-4">{children}</main>
    </>
  );
}
