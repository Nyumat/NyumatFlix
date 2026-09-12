"use client";

import { queryStaleTime } from "@/lib/cache-policy";
import {
  fetchPersonalizedHome,
  type PersonalizedHomeData,
} from "@/lib/personalization/personalized-home-client";
import { queryKeys } from "@/lib/query-keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback } from "react";

const emptyPersonalizedHome: PersonalizedHomeData = {
  recentlyWatched: [],
  upNext: [],
  becauseYouWatched: null,
};

export function usePersonalizedHome(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const isSignedIn = Boolean(session?.user?.id);
  const enabled = options?.enabled ?? true;

  const query = useQuery({
    queryKey: queryKeys.personalizedHome(),
    queryFn: fetchPersonalizedHome,
    enabled: enabled && isSignedIn,
    staleTime: queryStaleTime(5 * 60_000),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.personalizedHome(),
    });
  }, [queryClient]);

  const data = query.data ?? emptyPersonalizedHome;

  return {
    recentlyWatched: data.recentlyWatched,
    upNext: data.upNext,
    becauseYouWatched: data.becauseYouWatched,
    isLoading:
      enabled && isSignedIn && (sessionStatus === "loading" || query.isLoading),
    isSignedIn,
    invalidate,
  };
}
