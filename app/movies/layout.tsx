import { HeaderHero } from "@/components/hero";

export default async function MoviePageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <HeaderHero title="Movies" imageUrl={`/movie-hero.svg`} />
      <main className="mt-4">{children}</main>
    </div>
  );
}
