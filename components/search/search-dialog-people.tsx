"use client";

import { PersonCollage } from "@/components/search/person-collage";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

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
  known_for?: KnownForItem[];
}

interface SearchDialogPeopleProps {
  query: string;
  className?: string;
  onNavigate?: () => void;
}

export function SearchDialogPeople({
  query,
  className,
  onNavigate,
}: SearchDialogPeopleProps) {
  const router = useRouter();
  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const [people, setPeople] = useState<Person[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: "80px",
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
    onNavigate?.();
    router.push(`/person/${personId}`);
  };

  if (!trimmedQuery) return null;

  if (error) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          People
        </p>
        <p className="text-xs text-destructive">{error}</p>
      </div>
    );
  }

  if (people.length === 0 && isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          People
        </p>
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (people.length === 0) return null;

  return (
    <div className={cn("space-y-2.5", className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        People
      </p>
      <div className="space-y-2">
        {people.map((person) => (
          <button
            key={`dialog-person-${person.id}`}
            type="button"
            onClick={() => handlePersonClick(person.id)}
            className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-white/8 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
            aria-label={`View ${person.name}`}
          >
            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-white/10">
              <PersonCollage
                knownFor={person.known_for}
                profilePath={person.profile_path}
                className="transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/90 transition-colors group-hover:text-primary">
              {person.name}
            </span>
          </button>
        ))}
      </div>

      {currentPage < totalPages ? (
        <>
          <div ref={sentinelRef} className="h-4" aria-hidden />
          {isLoading ? (
            <p className="text-center text-[11px] text-muted-foreground">
              Loading more...
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
