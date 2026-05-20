"use client";

import { Poster } from "@/components/media/media-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchPreview } from "@/hooks/use-search-preview";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clock3, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import SearchResults from "./search-results";

interface SearchComponentProps {
  onSearch?: (query: string) => void;
}

interface SearchExperienceProps {
  initialQuery?: string;
  onSubmit?: (query: string) => void;
  inputClassName?: string;
  formClassName?: string;
  iconClassName?: string;
  submitButtonClassName?: string;
  submitIconClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  variant?: "page" | "dialog";
}

const SEARCH_RECENTS_KEY = "nyumatflix.search.recents";
const MAX_RECENT_SEARCHES = 3;

export function SearchComponent({ onSearch }: SearchComponentProps = {}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      if (searchQuery.trim()) {
        onSearch?.(searchQuery);
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
    },
    [onSearch, router],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(query);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTypingInInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;

      if (e.key === "/" && !isTypingInInput) {
        e.preventDefault();
        inputRef.current?.focus();
      }

      if (e.key === "Escape") {
        setIsFocused(false);
        inputRef.current?.blur();
      }

      if (
        !isTypingInInput &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        inputRef.current !== document.activeElement
      ) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative w-full max-w-lg mx-auto" suppressHydrationWarning>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search movies, TV shows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
            }}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-20 py-2.5 w-full rounded-xl border border-border/30 bg-background/60 shadow-sm backdrop-blur-md transition-all hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:border-border/30 dark:border-white/15 dark:bg-black/40 dark:hover:bg-white/15 dark:focus-visible:bg-white/15 placeholder:text-muted-foreground/60"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            {isMounted && !query && !isFocused && (
              <kbd className="hidden sm:inline-block px-2 py-1 text-xs bg-muted/50 text-muted-foreground rounded border border-muted-foreground/20">
                /
              </kbd>
            )}
            <Button
              type="submit"
              size="sm"
              className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!query.trim()}
            >
              <Search className="h-3 w-3" />
              <span className="ml-1 hidden sm:inline">Search</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function SearchPageClient() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const router = useRouter();

  return (
    <SearchExperience
      initialQuery={urlQuery}
      onSubmit={(trimmedQuery) => {
        router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      }}
      formClassName="relative max-w-sm md:max-w-lg mx-auto md:scale-150"
      inputClassName="bg-black/30 backdrop-blur-md border-white/20 focus:border-primary focus:bg-black/40 shadow-xl"
    />
  );
}

function SearchExperience({
  initialQuery = "",
  onSubmit,
  inputClassName,
  formClassName,
  iconClassName,
  submitButtonClassName,
  submitIconClassName,
  placeholder = "Search movies and TV shows...",
  autoFocus = false,
  variant = "page",
}: SearchExperienceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDialog = variant === "dialog";
  const hasSearched = Boolean(searchQuery.trim());

  const saveRecentSearch = useCallback((trimmedQuery: string) => {
    setRecentSearches((currentRecentSearches) => {
      const nextRecentSearches = [
        trimmedQuery,
        ...currentRecentSearches.filter(
          (recentSearch) =>
            recentSearch.toLowerCase() !== trimmedQuery.toLowerCase(),
        ),
      ].slice(0, MAX_RECENT_SEARCHES);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          SEARCH_RECENTS_KEY,
          JSON.stringify(nextRecentSearches),
        );
      }

      return nextRecentSearches;
    });
  }, []);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      const trimmedQuery = query.trim();
      setSearchQuery(trimmedQuery);
      if (isDialog) {
        saveRecentSearch(trimmedQuery);
      }
      onSubmit?.(trimmedQuery);
    }
  }, [query, isDialog, onSubmit, saveRecentSearch]);

  const handleRecentSearch = useCallback(
    (recentSearch: string) => {
      setQuery(recentSearch);
      setSearchQuery(recentSearch);
      saveRecentSearch(recentSearch);
      onSubmit?.(recentSearch);
    },
    [onSubmit, saveRecentSearch],
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SEARCH_RECENTS_KEY);
    }
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!isDialog || typeof window === "undefined") return;

    const storedRecentSearches =
      window.localStorage.getItem(SEARCH_RECENTS_KEY);
    if (!storedRecentSearches) return;

    try {
      const parsedRecentSearches = JSON.parse(storedRecentSearches);
      if (Array.isArray(parsedRecentSearches)) {
        setRecentSearches(
          parsedRecentSearches
            .filter((recentSearch) => typeof recentSearch === "string")
            .slice(0, MAX_RECENT_SEARCHES),
        );
      }
    } catch {
      window.localStorage.removeItem(SEARCH_RECENTS_KEY);
    }
  }, [isDialog]);

  useEffect(() => {
    if (autoFocus) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  return (
    <motion.div
      className={cn(
        "w-full flex flex-col",
        isDialog ? "min-h-[44vh] gap-5" : "gap-8",
      )}
      animate={
        isDialog
          ? {
              justifyContent: hasSearched ? "flex-start" : "center",
              gap: hasSearched ? 18 : 20,
            }
          : undefined
      }
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
    >
      {isDialog && (
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4">
          {hasSearched ? (
            <motion.p
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="px-1 text-sm text-muted-foreground"
            >
              Results for{" "}
              <span className="font-medium text-foreground">
                &quot;{searchQuery}&quot;
              </span>
            </motion.p>
          ) : (
            <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
              Search
            </DialogTitle>
          )}
          <DialogClose className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-muted-foreground transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-hidden focus:ring-1 focus:ring-white/25">
            <X className="size-5" />
            <span className="sr-only">Close search</span>
          </DialogClose>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <motion.div
          layout
          className={cn(
            isDialog
              ? "relative mx-auto w-full max-w-xl"
              : "relative mx-auto max-w-sm md:max-w-lg",
            formClassName,
          )}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        >
          <Search
            className={cn(
              "absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground",
              iconClassName,
            )}
          />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            className={cn(
              "pl-10 pr-12 md:pr-16 py-3 text-base w-full rounded-xl border transition-all duration-200 placeholder:text-muted-foreground/60 text-foreground",
              inputClassName,
            )}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 md:right-2 md:scale-50">
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className={cn(
                "size-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 md:size-10",
                submitButtonClassName,
              )}
              disabled={!query.trim()}
            >
              <ArrowRight
                className={cn("h-4 w-4 md:h-5 md:w-5", submitIconClassName)}
              />
            </Button>
          </div>
        </motion.div>
      </form>

      {isDialog && !hasSearched && recentSearches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="mx-auto w-full max-w-xl"
        >
          <div className="mb-3 flex items-center justify-between px-1.5">
            <p className="text-sm font-medium text-muted-foreground">Recent</p>
            <button
              type="button"
              onClick={clearRecentSearches}
              className="text-sm text-muted-foreground transition-colors hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1.5">
            {recentSearches.map((recentSearch) => (
              <button
                type="button"
                key={recentSearch}
                onClick={() => handleRecentSearch(recentSearch)}
                className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left text-base text-foreground/90 transition-colors hover:bg-white/10"
              >
                <Clock3 className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{recentSearch}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {hasSearched && (
          <motion.div
            key={searchQuery}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <SearchResults
              query={searchQuery}
              hideTitle={isDialog}
              hidePaginationInfo={isDialog}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-h-[88vh] max-w-5xl overflow-y-auto border-0 bg-transparent p-5 shadow-none duration-100 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[50%] data-[state=closed]:zoom-out-100 sm:p-7"
      >
        <DialogDescription className="sr-only">
          Search movies and TV shows without leaving the current page.
        </DialogDescription>
        <SearchExperience
          autoFocus={open}
          variant="dialog"
          formClassName="max-w-xl md:max-w-xl"
          iconClassName="left-4 size-5 text-muted-foreground"
          inputClassName="h-14 rounded-2xl border-white/10 bg-black/55 pl-12 pr-16 text-lg shadow-none backdrop-blur-xl placeholder:text-muted-foreground/75 focus-visible:border-white/20 focus-visible:bg-black/65 focus-visible:ring-1 focus-visible:ring-white/10 focus-visible:ring-offset-0"
          placeholder="Type here to search..."
          submitButtonClassName="right-2 size-8 bg-white/10 text-muted-foreground hover:bg-white/15 hover:text-white md:size-8"
          submitIconClassName="size-5 md:size-5"
        />
      </DialogContent>
    </Dialog>
  );
}

export interface NavbarSearchClientProps {
  className?: string;
  onAfterNavigation?: () => void;
}

export const NavbarSearchClient = forwardRef<
  HTMLInputElement,
  NavbarSearchClientProps
>(({ className, onAfterNavigation }, ref) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isMouseOverResults, setIsMouseOverResults] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const innerRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const inputRef = (ref as React.RefObject<HTMLInputElement>) || innerRef;

  const { results, isLoading } = useSearchPreview(query);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      onAfterNavigation?.();
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowPreview(false);
    }
  }, [query, router, onAfterNavigation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPreview || !results.length) return;

      const totalItems = results.length + 1;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            const selectedResult = results[selectedIndex];
            if (selectedResult) {
              const mediaType =
                selectedResult.media_type === "movie" ? "movies" : "tvshows";
              onAfterNavigation?.();
              router.push(`/${mediaType}/${selectedResult.id}`);
              setShowPreview(false);
            }
          } else {
            handleSearch();
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowPreview(false);
          setSelectedIndex(-1);
          if (inputRef.current) {
            inputRef.current.blur();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    showPreview,
    results,
    selectedIndex,
    handleSearch,
    router,
    inputRef,
    onAfterNavigation,
  ]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  useEffect(() => {
    setShowPreview(
      query.trim().length > 0 && isFocused && (results.length > 0 || isLoading),
    );
  }, [query, results, isLoading, isFocused]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [inputRef]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const searchContainer = (inputRef as React.RefObject<HTMLInputElement>)
        ?.current?.parentElement?.parentElement;

      if (searchContainer && !searchContainer.contains(target)) {
        setShowPreview(false);
      }
    };

    if (showPreview) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPreview, inputRef]);

  return (
    <div
      className={cn("max-w-xl grow mx-auto md:max-w-2xl", className)}
      suppressHydrationWarning
    >
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search..."
            suppressHydrationWarning
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              if (query.trim().length > 0) {
                setShowPreview(true);
              }
            }}
            onBlur={() => {
              setIsFocused(false);
              setTimeout(() => {
                if (!isMouseOverResults) {
                  setShowPreview(false);
                }
              }, 100);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (!showPreview || selectedIndex === -1) {
                  handleSearch();
                }
              }
            }}
            className="pl-8 pr-20 py-2 text-sm w-full rounded-full border border-border/30 bg-background/60 shadow-sm backdrop-blur-md transition-all hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:border-border/30 dark:border-white/15 dark:bg-black/40 dark:hover:bg-white/15 dark:focus-visible:bg-white/15 placeholder:text-muted-foreground/55"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            {isMounted && !query && !isFocused && (
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-xs text-muted-foreground/80 rounded border border-border/30 bg-muted/20">
                ⌘ K
              </kbd>
            )}
            {query && (
              <button
                type="button"
                onClick={handleSearch}
                className="p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                disabled={!query.trim()}
              >
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        {showPreview && (
          <div
            className="absolute top-full left-0 right-0 mt-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-lg shadow-xl z-50 max-h-80 overflow-hidden"
            onMouseEnter={() => setIsMouseOverResults(true)}
            onMouseLeave={() => setIsMouseOverResults(false)}
          >
            <div className="max-h-72 overflow-y-auto" ref={resultsRef}>
              {isLoading ? (
                <div className="p-3">
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-12 w-8 rounded" />
                        <div className="space-y-1 flex-1">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-2 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : query.trim().length > 0 && results.length > 0 ? (
                <>
                  <div className="py-1">
                    {results.slice(0, 6).map((item, index) => {
                      const title = item.title || item.name || "Unknown Title";
                      const mediaType =
                        item.media_type === "movie" ? "movies" : "tvshows";
                      const href = `/${mediaType}/${item.id}`;

                      return (
                        <div
                          key={`${item.id}-${item.media_type}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onAfterNavigation?.();
                            router.push(href);
                            setShowPreview(false);
                          }}
                          onMouseEnter={() => {
                            router.prefetch(href);
                          }}
                          className={`flex items-center gap-2 p-2 cursor-pointer transition-all duration-150 hover:bg-accent/50 ${
                            index === selectedIndex ? "bg-accent/80" : ""
                          }`}
                        >
                          <div className="relative w-8 h-12 shrink-0">
                            {item.poster_path ? (
                              <Poster
                                posterPath={item.poster_path}
                                title={title}
                                size="small"
                                className="rounded"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                                <Search className="w-2 h-2 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-xs">
                              {title}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {item.media_type}
                              {item.genre_names?.[0] &&
                                ` • ${item.genre_names[0]}`}
                              {(item.release_date || item.first_air_date) &&
                                ` • ${(item.release_date || item.first_air_date)?.split("-")[0]}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-border">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSearch();
                      }}
                      className={`w-full p-2 text-left transition-colors duration-150 flex items-center justify-between text-xs text-muted-foreground ${
                        selectedIndex === results.length
                          ? "bg-accent/80 border border-accent-foreground/20"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <span>Go to search page</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </>
              ) : query.trim().length > 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    No results found
                  </p>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSearch();
                    }}
                    className="mt-1 text-xs text-primary hover:underline"
                  >
                    Search anyway
                  </button>
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Start typing to search...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

NavbarSearchClient.displayName = "NavbarSearchClient";
