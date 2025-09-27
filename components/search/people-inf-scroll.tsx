"use client";

import { InfiniteScroll } from "@/components/ui/infinite-scroll";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User } from "lucide-react";
import Image from "next/legacy/image";
import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";

interface Person {
  id: number;
  name: string;
  profile_path?: string | null;
  popularity?: number;
  known_for_department?: string;
}

interface PeopleInfiniteScrollProps {
  query: string;
}

export function PeopleInfiniteScroll({ query }: PeopleInfiniteScrollProps) {
  const router = useRouter();
  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const [people, setPeople] = useState<Person[]>([]);
  const [_currentPage, setCurrentPage] = useState<number>(1);
  const [_totalPages, setTotalPages] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

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

  const getListNodes = useCallback(
    async (offset: number) => {
      try {
        const { results, page, total_pages } = await fetchPage(offset);
        setPeople((prev) => [...prev, ...results]);
        setCurrentPage(page);
        setTotalPages(total_pages);

        // Return a dummy element since we're managing state internally
        return [
          React.createElement("div"),
          total_pages > offset ? offset + 1 : null,
        ] as const;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        return null;
      }
    },
    [fetchPage],
  );

  const handlePersonClick = (personId: number) => {
    router.push(`/person/${personId}`);
  };

  if (!trimmedQuery) return null;

  if (error) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">People</h4>
        <div className="text-xs text-destructive">{error}</div>
      </div>
    );
  }

  const renderPeopleContent = (peopleList: Person[], isLoading: boolean) => (
    <div className="bg-card/50 backdrop-blur-sm border rounded-lg overflow-hidden">
      <div className="p-4 pb-2 border-b">
        <h4 className="text-sm font-medium text-foreground">People</h4>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="p-4 pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
            {peopleList.map((person) => (
              <button
                key={person.id}
                onClick={() => handlePersonClick(person.id)}
                className="group text-left w-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-md"
                aria-label={`View ${person.name}`}
              >
                <div className="rounded-md overflow-hidden aspect-[3/4] bg-muted relative">
                  {person.profile_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                      layout="fill"
                      objectFit="cover"
                      alt={person.name}
                      className="transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <User size={32} />
                    </div>
                  )}
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

          {/* end of results indicator */}
          {peopleList.length > 0 && (
            <div className="text-center py-2 mt-3">
              <span className="text-xs text-muted-foreground">
                {isLoading ? "Loading more..." : "End of results"}
              </span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <InfiniteScroll<Person>
      getListNodes={getListNodes}
      initialOffset={1}
      initialItems={people}
      renderContent={renderPeopleContent}
    />
  );
}
