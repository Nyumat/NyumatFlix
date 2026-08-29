import "server-only";

import { fetchAniListPage } from "@/lib/anilist";
import { withDevelopmentDataCache } from "@/lib/server/development-data-cache";

type FetchAniListPageOptions = Parameters<typeof fetchAniListPage>[0];

export const fetchStableAniListPage = (options: FetchAniListPageOptions) =>
  withDevelopmentDataCache({
    key: `anilist-page:${JSON.stringify({
      page: options.page ?? 1,
      perPage: options.perPage ?? 24,
      params: options.params,
    })}`,
    load: () => fetchAniListPage(options),
  });
