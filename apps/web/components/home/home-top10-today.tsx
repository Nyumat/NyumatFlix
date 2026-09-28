import { getHomeTop10Today } from "@/lib/server/home-hub-data";
import { prepareCatalogRowItemsForRsc } from "@/lib/server/prepare-catalog-row-items";
import { HomeTop10Row } from "@/components/home/home-top10-today-row";

export async function HomeTop10Today() {
  const items = await getHomeTop10Today();

  if (items.length === 0) return null;

  return <HomeTop10Row items={await prepareCatalogRowItemsForRsc(items)} />;
}
