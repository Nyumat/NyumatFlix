import { fetchAllSeasonDetails } from "@/components/tvshow/tvshow-api";
import { TvShowDetailShell } from "@/components/tvshow/tvshow-detail-shell";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
import { notFound } from "next/navigation";

export const revalidate = 3600;

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function TVShowDetailLayout({ children, params }: Props) {
  const { id } = await params;

  let details;
  try {
    details = await getCachedTvShowDetail(id);
  } catch {
    notFound();
  }

  if (!details) {
    notFound();
  }

  const [anilistId, allSeasonDetails] = await Promise.all([
    getAnilistIdForMedia(details),
    fetchAllSeasonDetails(id, details.seasons),
  ]);

  return (
    <TvShowDetailShell
      details={details}
      tvId={id}
      anilistId={anilistId}
      allSeasonDetails={allSeasonDetails}
    >
      {children}
    </TvShowDetailShell>
  );
}
