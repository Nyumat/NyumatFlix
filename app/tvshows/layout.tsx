import { HeaderHero } from "@/components/hero";

export default async function TVShowPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <HeaderHero title="TV Shows" imageUrl={`/tv-show-hero.svg`} />
      <main className="mt-4">{children}</main>
    </div>
  );
}
