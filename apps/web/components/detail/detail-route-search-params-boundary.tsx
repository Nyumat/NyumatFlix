import { getDetailRouteSearchParams } from "@/lib/detail-search-params";
import { Suspense, type ReactNode } from "react";

export type DetailRouteSearchParams = {
  anilistId: number | null;
  season: number | null;
  searchParams: URLSearchParams;
};

const parsePositiveInt = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

type DetailRouteSearchParamsBoundaryProps = {
  children: (params: DetailRouteSearchParams) => ReactNode;
  fallback?: ReactNode;
};

const DetailRouteSearchParamsReader = async ({
  children,
}: DetailRouteSearchParamsBoundaryProps) => {
  const searchParams = await getDetailRouteSearchParams();

  return children({
    anilistId: parsePositiveInt(searchParams.get("anilistId")),
    season: parsePositiveInt(searchParams.get("season")),
    searchParams,
  });
};

export const DetailRouteSearchParamsBoundary = ({
  children,
  fallback = null,
}: DetailRouteSearchParamsBoundaryProps) => (
  <Suspense fallback={fallback}>
    <DetailRouteSearchParamsReader>{children}</DetailRouteSearchParamsReader>
  </Suspense>
);
