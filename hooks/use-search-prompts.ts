"use client";

import type { SearchPromptsResponse } from "@/lib/search/search-prompts";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";

const EMPTY_SEARCH_PROMPTS: SearchPromptsResponse = { prompts: [] };

async function fetchSearchPrompts(
  signal?: AbortSignal,
): Promise<SearchPromptsResponse> {
  const response = await fetch("/api/search-prompts", { signal });

  if (!response.ok) {
    throw new Error("Search prompts failed");
  }

  const data = (await response.json()) as SearchPromptsResponse;
  return {
    prompts: data.prompts ?? [],
  };
}

export function useSearchPrompts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.searchPrompts(),
    queryFn: ({ signal }) => fetchSearchPrompts(signal),
    staleTime: 30 * 60 * 1000,
  });

  return {
    prompts: data?.prompts ?? EMPTY_SEARCH_PROMPTS.prompts,
    isLoading,
    isError,
  };
}
