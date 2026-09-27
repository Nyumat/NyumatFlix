import { CatalogListLoading } from "@/components/layout/page-loading/catalog-list-loading";

export default function TrendingPeopleLoading() {
  return (
    <CatalogListLoading
      centered
      gridClassName="people-grid"
      cardStyle="poster"
    />
  );
}
