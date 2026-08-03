"use client";

import { PersonCollage } from "@/components/search/person-collage";
import { usePeopleSearch } from "@/hooks/use-people-search";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";

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
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return null;
  }

  return (
    <SearchDialogPeopleResults
      key={trimmedQuery}
      trimmedQuery={trimmedQuery}
      className={className}
      onNavigate={onNavigate}
    />
  );
}

function SearchDialogPeopleResults({
  trimmedQuery,
  className,
  onNavigate,
}: {
  trimmedQuery: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const {
    people,
    currentPage,
    totalPages,
    isLoading,
    error,
    loadMore,
    hasMore,
  } = usePeopleSearch({ query: trimmedQuery });

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: "80px",
  });

  useEffect(() => {
    if (inView && !isLoading && hasMore) {
      void loadMore();
    }
  }, [hasMore, inView, isLoading, loadMore]);

  const handlePersonClick = (personId: number) => {
    onNavigate?.();
    router.push(`/person/${personId}`);
  };

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

  if (people.length === 0) {
    return null;
  }

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
