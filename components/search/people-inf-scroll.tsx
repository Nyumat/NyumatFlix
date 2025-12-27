"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { PersonCollage } from "./person-collage";

interface KnownForItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  media_type: string;
}

interface Person {
  id: number;
  name: string;
  profile_path?: string | null;
  popularity?: number;
  known_for_department?: string;
  known_for?: KnownForItem[];
}

interface PeopleInfiniteScrollProps {
  query: string;
}

export function PeopleInfiniteScroll({ query }: PeopleInfiniteScrollProps) {
  const router = useRouter();
  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const [people, setPeople] = useState<Person[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: "100px",
  });

  useEffect(() => {
    setPeople([]);
    setCurrentPage(1);
    setTotalPages(1);
    setError(null);
    initialLoadRef.current = false;
  }, [trimmedQuery]);

  const fetchPage = useCallback(
    async (page: number) => {
      if (!trimmedQuery) return { results: [], page: 1, total_pages: 0 };

      const url = new URL("/api/person-search", window.location.origin);
      url.searchParams.set("query", trimmedQuery);
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || "Failed to fetch people");
      }

      const json = (await res.json()) as {
        results: Person[];
        page: number;
        total_pages: number;
        total_results: number;
      };

      return {
        results: json.results || [],
        page: json.page || page,
        total_pages: json.total_pages || 0,
      };
    },
    [trimmedQuery],
  );

  const loadInitial = useCallback(async () => {
    if (initialLoadRef.current || isLoading || !trimmedQuery) return;
    initialLoadRef.current = true;

    try {
      setIsLoading(true);
      const { results, page, total_pages } = await fetchPage(1);
      setPeople(results);
      setCurrentPage(page);
      setTotalPages(total_pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, isLoading, trimmedQuery]);

  const loadMore = useCallback(async () => {
    if (isLoading || currentPage >= totalPages) return;

    try {
      setIsLoading(true);
      const nextPage = currentPage + 1;
      const { results, page, total_pages } = await fetchPage(nextPage);
      setPeople((prev) => [...prev, ...results]);
      setCurrentPage(page);
      setTotalPages(total_pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, fetchPage, isLoading, totalPages]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (inView && !isLoading && currentPage < totalPages) {
      void loadMore();
    }
  }, [inView, isLoading, currentPage, totalPages, loadMore]);

  const handlePersonClick = (personId: number) => {
    router.push(`/person/${personId}`);
  };

  if (!trimmedQuery) return null;

  if (error) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">People</h4>
        <div className="text-xs text-destructive">{error}</div>
      </div>
    );
  }

  if (people.length === 0 && isLoading) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">People</h4>
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (people.length === 0) return null;

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg overflow-hidden">
      <div className="p-4 pb-2 border-b border-border/50">
        <h4 className="text-sm font-medium text-foreground">People</h4>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="p-4 pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
            {people.map((person) => (
              <button
                key={`person-${person.id}-${crypto.randomUUID()}`}
                onClick={() => handlePersonClick(person.id)}
                className="group text-left w-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-md"
                aria-label={`View ${person.name}`}
              >
                <div className="rounded-md overflow-hidden aspect-[3/4] bg-muted relative group-hover:ring-2 group-hover:ring-primary/50 transition-all duration-300">
                  <PersonCollage
                    knownFor={person.known_for}
                    profilePath={person.profile_path}
                    className="group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs font-medium text-foreground/90 line-clamp-1 group-hover:text-primary transition-colors">
                    {person.name}
                  </p>
                  {person.known_for_department && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {person.known_for_department}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {currentPage < totalPages && (
            <>
              <div ref={sentinelRef} className="h-8 mt-3" aria-hidden />
              {isLoading && (
                <div className="text-center py-2">
                  <span className="text-xs text-muted-foreground">
                    Loading more...
                  </span>
                </div>
              )}
            </>
          )}

          {currentPage >= totalPages && people.length > 0 && (
            <div className="text-center py-2 mt-3">
              <span className="text-xs text-muted-foreground">
                End of results
              </span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
