import { HeroTvEpisodePanel } from "@/components/hero/hero-tv-episode-panel";
import { fetchAllSeasonDetails } from "@/components/tvshow/tvshow-api";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const m = await getCachedTvShowDetail(id).catch(() => null);
  if (!m || !("name" in m)) return { title: "Seasons & Episodes" };
  return { title: `Seasons & Episodes · ${m.name}` };
}

export default async function TVShowSeasonsEpisodesPage(props: Props) {
  const { id } = await props.params;
  const details = await getCachedTvShowDetail(id).catch(() => null);
  if (!details) notFound();

  const allSeasonDetails = await fetchAllSeasonDetails(id, details.seasons);

  return (
    <section
      id="seasons-episodes-panel"
      data-episode-browser
      className="scroll-mt-24"
    >
      <HeroTvEpisodePanel
        tvId={id}
        details={details}
        allSeasonDetails={allSeasonDetails}
      />
    </section>
  );
}
