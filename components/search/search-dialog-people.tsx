"use client";

import { PersonSearchAvatar } from "@/components/search/person-collage";
import {
  usePeopleSearch,
  type PersonSearchResult,
} from "@/hooks/use-people-search";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { HighlightedText } from "./highlighted-text";
import { SearchListRow } from "./search-list-row";

interface SearchDialogPeopleProps {
  query: string;
  className?: string;
  onNavigate?: () => void;
  variant?: "list" | "horizontal";
  selectionMode?: "select" | "navigate";
  selectedPersonId?: number | null;
  onSelectPerson?: (person: PersonSearchResult) => void;
}

export function SearchDialogPeople({
  query,
  className,
  onNavigate,
  variant = "list",
  selectionMode = "navigate",
  selectedPersonId = null,
  onSelectPerson,
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
      variant={variant}
      selectionMode={selectionMode}
      selectedPersonId={selectedPersonId}
      onSelectPerson={onSelectPerson}
    />
  );
}

function SearchDialogPeopleResults({
  trimmedQuery,
  className,
  onNavigate,
  variant,
  selectionMode,
  selectedPersonId,
  onSelectPerson,
}: {
  trimmedQuery: string;
  className?: string;
  onNavigate?: () => void;
  variant: "list" | "horizontal";
  selectionMode: "select" | "navigate";
  selectedPersonId: number | null;
  onSelectPerson?: (person: PersonSearchResult) => void;
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

  useEffect(() => {
    if (
      selectionMode !== "select" ||
      variant !== "list" ||
      people.length === 0
    ) {
      return;
    }
    if (
      selectedPersonId &&
      people.some((person) => person.id === selectedPersonId)
    ) {
      return;
    }
    onSelectPerson?.(people[0]);
  }, [onSelectPerson, people, selectedPersonId, selectionMode, variant]);

  const handlePersonClick = (person: PersonSearchResult) => {
    if (selectionMode === "select") {
      onSelectPerson?.(person);
      return;
    }

    onNavigate?.();
    router.push(`/person/${person.id}`);
  };

  if (error) {
    return (
      <div
        className={cn("space-y-2", className)}
        data-testid="search-people-error"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          People
        </p>
        <p className="text-xs text-destructive">{error}</p>
      </div>
    );
  }

  if (people.length === 0 && isLoading) {
    return (
      <div
        className={cn("space-y-2", className)}
        data-testid="search-people-loading"
      >
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

  if (variant === "horizontal") {
    return (
      <div
        className={cn("space-y-2.5", className)}
        data-testid="search-people-horizontal"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          People
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {people.map((person) => {
            const isSelected = selectedPersonId === person.id;

            return (
              <button
                key={`dialog-person-h-${person.id}`}
                type="button"
                onClick={() => handlePersonClick(person)}
                className={cn("group w-20 shrink-0 text-left outline-none")}
                aria-label={`View ${person.name}`}
                aria-pressed={
                  selectionMode === "select" ? isSelected : undefined
                }
              >
                <div
                  className={cn(
                    "relative aspect-[3/4] overflow-hidden bg-neutral-900 transition-[filter] duration-150",
                    isSelected
                      ? "brightness-100"
                      : "brightness-[0.92] group-hover:brightness-100 group-active:brightness-[0.88]",
                  )}
                >
                  <PersonSearchAvatar
                    profilePath={person.profile_path}
                    name={person.name}
                  />
                </div>
                <p
                  className={cn(
                    "mt-1.5 truncate text-[11px] font-medium",
                    isSelected ? "text-foreground" : "text-foreground/90",
                  )}
                >
                  {person.name}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-2.5", className)}
      data-testid="search-people-list"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        People
        {people.length > 0 ? (
          <span className="ml-1.5 font-normal normal-case text-muted-foreground/80">
            ({people.length}
            {hasMore ? "+" : ""})
          </span>
        ) : null}
      </p>
      <div className="space-y-1">
        {people.map((person) => {
          const isSelected = selectedPersonId === person.id;

          return (
            <SearchListRow
              key={`dialog-person-${person.id}`}
              onClick={() => handlePersonClick(person)}
              isSelected={isSelected}
              className="py-1.5"
              aria-label={`View ${person.name}`}
              aria-pressed={selectionMode === "select" ? isSelected : undefined}
            >
              <div className="relative size-11 shrink-0 overflow-hidden bg-neutral-900">
                <PersonSearchAvatar
                  profilePath={person.profile_path}
                  name={person.name}
                />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-medium",
                    isSelected ? "text-foreground" : "text-foreground/90",
                  )}
                >
                  <HighlightedText text={person.name} query={trimmedQuery} />
                </span>
                {person.known_for_department ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {person.known_for_department}
                  </span>
                ) : null}
              </div>
            </SearchListRow>
          );
        })}
      </div>

      {currentPage < totalPages ? (
        <>
          <div ref={sentinelRef} className="h-1" aria-hidden />
          {isLoading ? (
            <p className="py-1 text-center text-xs text-muted-foreground">
              Loading more people...
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
