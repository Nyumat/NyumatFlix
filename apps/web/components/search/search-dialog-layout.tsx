"use client";

import { getHref, getStableCardKey } from "@/lib/cards/selectors";
import type { CanonicalMediaCard } from "@/lib/domain/typings";
import type { PersonSearchResult } from "@/hooks/use-people-search";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SearchDialogPeople } from "./search-dialog-people";
import { SearchMetadataPreview } from "./search-metadata-preview";
import { SearchResultRow } from "./search-result-row";
import type { SearchContentFilter } from "./search-type-tabs";

type SearchDialogResultsLayoutProps = {
  query: string;
  contentFilter: SearchContentFilter;
  validMediaItems: CanonicalMediaCard[];
  allGenres: Record<number, string>;
  genreFilterPanel: ReactNode;
  showMediaResults: boolean;
  showPeopleResults: boolean;
  isFetching: boolean;
  currentPage: number;
  totalPages: number;
  loadMoreRef: (node?: Element | null) => void;
  onNavigate?: () => void;
};

const enrichItemGenres = (
  item: CanonicalMediaCard,
  allGenres: Record<number, string>,
): CanonicalMediaCard => ({
  ...item,
  genres:
    item.genres ??
    item.genre_ids
      ?.map((id) => ({ id, name: allGenres[id] }))
      .filter((genre) => genre.name && genre.id),
});

export function SearchDialogResultsLayout({
  query,
  contentFilter,
  validMediaItems,
  allGenres,
  genreFilterPanel,
  showMediaResults,
  showPeopleResults,
  isFetching,
  currentPage,
  totalPages,
  loadMoreRef,
  onNavigate,
}: SearchDialogResultsLayoutProps) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedMediaKey, setSelectedMediaKey] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] =
    useState<PersonSearchResult | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  const enrichedItems = useMemo(
    () => validMediaItems.map((item) => enrichItemGenres(item, allGenres)),
    [allGenres, validMediaItems],
  );

  const selectedMediaIndex = useMemo(() => {
    if (!selectedMediaKey) return -1;
    return enrichedItems.findIndex(
      (item) => getStableCardKey(item) === selectedMediaKey,
    );
  }, [enrichedItems, selectedMediaKey]);

  const selectedMediaItem =
    selectedMediaIndex >= 0 ? enrichedItems[selectedMediaIndex] : null;

  const previewPerson = selectedPerson;
  const previewMedia = selectedPerson ? null : selectedMediaItem;

  const isPeopleMode = contentFilter === "person";

  useEffect(() => {
    setSelectedMediaKey(null);
    setSelectedPerson(null);
    setSelectedPersonId(null);
  }, [query, contentFilter]);

  useEffect(() => {
    if (isPeopleMode || enrichedItems.length === 0) return;

    setSelectedMediaKey((current) => {
      if (
        current &&
        enrichedItems.some((item) => getStableCardKey(item) === current)
      ) {
        return current;
      }
      return getStableCardKey(enrichedItems[0]);
    });
  }, [enrichedItems, isPeopleMode]);

  useEffect(() => {
    if (selectedMediaIndex < 0 || !listRef.current) return;
    const selectedEl = listRef.current.querySelector<HTMLElement>(
      `[data-selected="true"]`,
    );
    selectedEl?.scrollIntoView({ block: "nearest" });
  }, [selectedMediaIndex, selectedMediaKey]);

  const handleSelectMedia = useCallback((item: CanonicalMediaCard) => {
    setSelectedMediaKey(getStableCardKey(item));
    setSelectedPerson(null);
    setSelectedPersonId(null);
  }, []);

  const handleSelectPerson = useCallback((person: PersonSearchResult) => {
    setSelectedPerson(person);
    setSelectedPersonId(person.id);
    setSelectedMediaKey(null);
  }, []);

  const navigateToSelected = useCallback(() => {
    if (selectedPerson) {
      onNavigate?.();
      router.push(`/person/${selectedPerson.id}`);
      return;
    }

    if (selectedMediaItem) {
      onNavigate?.();
      router.push(getHref(selectedMediaItem));
    }
  }, [onNavigate, router, selectedMediaItem, selectedPerson]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showMediaResults && !isPeopleMode) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("[data-search-dialog-ignore-keys]"))
      ) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (isPeopleMode || enrichedItems.length === 0) return;

        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const currentIndex = selectedMediaIndex >= 0 ? selectedMediaIndex : 0;
        const nextIndex = Math.max(
          0,
          Math.min(enrichedItems.length - 1, currentIndex + delta),
        );
        setSelectedMediaKey(getStableCardKey(enrichedItems[nextIndex]));
        return;
      }

      if (event.key === "Enter" && !event.shiftKey && !event.metaKey) {
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        if (
          target instanceof HTMLAnchorElement ||
          target instanceof HTMLButtonElement
        ) {
          return;
        }

        if (selectedPerson || selectedMediaItem) {
          event.preventDefault();
          navigateToSelected();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enrichedItems,
    isPeopleMode,
    navigateToSelected,
    selectedMediaIndex,
    selectedMediaItem,
    selectedPerson,
    showMediaResults,
  ]);

  const hasPreview = Boolean(previewMedia || previewPerson);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-md border border-white/8 bg-[#0c0c0e]/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md sm:p-4"
      data-testid="search-dialog-layout"
    >
      {genreFilterPanel}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-4">
        {hasPreview ? (
          <div className="order-1 lg:hidden">
            <SearchMetadataPreview
              mediaItem={previewMedia}
              person={previewPerson}
              query={query}
              onNavigate={onNavigate}
              layout="banner"
            />
          </div>
        ) : null}

        <div className="order-2 flex min-h-0 min-w-0 flex-col gap-3 lg:order-1">
          {showMediaResults ? (
            <div
              ref={listRef}
              className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] lg:max-h-[min(58vh,560px)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15"
              data-testid="search-results-list"
              role="listbox"
              aria-label="Search results"
              aria-activedescendant={
                selectedMediaIndex >= 0
                  ? `search-result-option-${selectedMediaIndex}`
                  : undefined
              }
            >
              {enrichedItems.length > 0 ? (
                enrichedItems.map((item, index) => {
                  const key = getStableCardKey(item);
                  const isSelected =
                    selectedMediaKey === key && !selectedPerson;

                  return (
                    <SearchResultRow
                      key={key}
                      item={item}
                      query={query}
                      testIdPrefix="search-result-card"
                      isSelected={isSelected}
                      onSelect={() => handleSelectMedia(item)}
                      optionIndex={index}
                    />
                  );
                })
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No titles match your filters.
                </p>
              )}

              {currentPage < totalPages && showMediaResults ? (
                <div className="pt-2" data-testid="search-load-more">
                  <div ref={loadMoreRef} className="h-1" aria-hidden />
                  {isFetching ? (
                    <p className="py-2 text-center text-xs text-muted-foreground">
                      Loading more...
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {showPeopleResults ? (
            <SearchDialogPeople
              query={query}
              onNavigate={onNavigate}
              variant={contentFilter === "person" ? "list" : "horizontal"}
              className={
                contentFilter === "person" ? "min-h-0 flex-1" : undefined
              }
              selectionMode="select"
              selectedPersonId={selectedPersonId}
              onSelectPerson={handleSelectPerson}
            />
          ) : null}
        </div>

        <div className="order-3 hidden lg:order-2 lg:block lg:sticky lg:top-0 lg:self-start">
          <SearchMetadataPreview
            mediaItem={previewMedia}
            person={previewPerson}
            query={query}
            onNavigate={onNavigate}
            layout="panel"
          />
        </div>
      </div>
    </div>
  );
}
