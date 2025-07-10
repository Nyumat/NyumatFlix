"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchPreview } from "@/hooks/use-search-preview";
import { cn } from "@/lib/utils";
import { ArrowRight, Search } from "lucide-react";
import Image from "next/legacy/image";
import { useRouter, useSearchParams } from "next/navigation";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import SearchResults from "./search-results";

/**
 * Props for the SearchComponent
 */
interface SearchComponentProps {
  /** Optional callback function when search is performed */
  onSearch?: (query: string) => void;
}

/**
 * SearchComponent provides a search input with keyboard shortcuts and preview functionality
 * Features: keyboard shortcuts (/ to focus, ESC to blur), auto-focus on typing, search suggestions
 * @param props - The component props
 * @returns A search input component with enhanced UX features
 */
export function SearchComponent({ onSearch }: SearchComponentProps = {}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
    <div className="relative w-full max-w-lg mx-auto">
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
              // Don't hide preview on blur - let user interactions handle it
            }}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-20 py-2.5 w-full rounded-xl bg-muted/30 border border-muted-foreground/20 focus:border-primary focus:bg-background/50 transition-all duration-200 placeholder:text-muted-foreground/60"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            {/* Only show / shortcut when input is empty and not focused */}
            {!query && !isFocused && (
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

/**
 * SearchPageClient provides a Google-style search interface with results shown below
 * Features: direct typing, search results display, keyboard navigation
 * @returns A search interface component with integrated results
 */
export function SearchPageClient() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(urlQuery);
  const [searchQuery, setSearchQuery] = useState(urlQuery); // Initialize with URL query
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Update query when URL changes
  useEffect(() => {
    const newQuery = searchParams.get("q") || "";
    setQuery(newQuery);
    setSearchQuery(newQuery);
  }, [searchParams]);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      const trimmedQuery = query.trim();
      setSearchQuery(trimmedQuery);
      // Update URL with new query
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    }
  }, [query, router]);

  // Global keyboard shortcut (⌘K)
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
    <div className="w-full flex flex-col gap-8">
      {/* Search Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <div className="relative max-w-sm md:max-w-lg mx-auto md:scale-150">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search movies and TV shows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="pl-10 pr-16 py-3 text-base w-full rounded-xl bg-black/30 backdrop-blur-md border border-white/20 focus:border-primary focus:bg-black/40 transition-all duration-200 placeholder:text-muted-foreground/60 text-foreground shadow-xl"
          />
          <div className="absolute md:scale-50 right-2 top-1/2 transform -translate-y-1/2">
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="size-6 md:size-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!query.trim()}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </form>

      {/* Search Results */}
      {searchQuery && <SearchResults query={searchQuery} />}
    </div>
  );
}

/**
 * Props for NavbarSearchClient component
 */
interface NavbarSearchClientProps {
  /** Optional className for styling */
  className?: string;
}

/**
 * NavbarSearchClient provides a more compact search interface optimized for navbar use
 * Features: responsive sizing, compact design, same functionality as SearchPageClient
 * @returns A navbar-optimized search component
 */
export const NavbarSearchClient = forwardRef<
  HTMLInputElement,
  NavbarSearchClientProps
>(({ className }, ref) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isMouseOverResults, setIsMouseOverResults] = useState(false);
  const innerRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Use the forwarded ref if available, otherwise use innerRef
  const inputRef = (ref as React.RefObject<HTMLInputElement>) || innerRef;

  const { results, isLoading } = useSearchPreview(query);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      // Navigate to search page with query parameters
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowPreview(false);
    }
  }, [query, router]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPreview || !results.length) return;

      // Total navigable items: results + "View all results" option
      const totalItems = results.length + 1;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          // If selected index is within results, go to that result
          if (selectedIndex < results.length) {
            const selectedResult = results[selectedIndex];
            if (selectedResult) {
              const mediaType =
                selectedResult.media_type === "movie" ? "movies" : "tvshows";
              router.push(`/${mediaType}/${selectedResult.id}`);
              setShowPreview(false);
            }
          } else {
            // If selected index is the "View all results" option
            handleSearch();
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowPreview(false);
          setSelectedIndex(0);
          if (inputRef.current) {
            inputRef.current.blur();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showPreview, results, selectedIndex, handleSearch, router, inputRef]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Show/hide preview based on query and focus
  useEffect(() => {
    setShowPreview(
      query.trim().length > 0 && isFocused && (results.length > 0 || isLoading),
    );
  }, [query, results, isLoading, isFocused]);

  // Global keyboard shortcut (⌘K)
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

  // Click outside handler
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
    <div className={cn("w-full", className)}>
      {/* Search Input - More compact for navbar */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search..."
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
              // Hide preview after a delay if mouse is not over results
              setTimeout(() => {
                if (!isMouseOverResults) {
                  setShowPreview(false);
                }
              }, 100);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (!showPreview || !results.length)) {
                handleSearch();
              }
            }}
            className="pl-10 pr-12 py-2 text-sm w-full rounded-lg bg-muted/30 border border-muted-foreground/20 focus:border-primary focus:bg-background/50 transition-all duration-200 placeholder:text-muted-foreground/60"
          />
          {!query && !isFocused && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-xs bg-muted/50 text-muted-foreground rounded border border-muted-foreground/20">
                ⌘ K
              </kbd>
            </div>
          )}
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
                            router.push(href);
                            setShowPreview(false);
                          }}
                          className={`flex items-center gap-2 p-2 cursor-pointer transition-all duration-150 hover:bg-accent/50 ${
                            index === selectedIndex ? "bg-accent/80" : ""
                          }`}
                        >
                          <div className="relative w-8 h-12 flex-shrink-0">
                            {item.poster_path ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                                alt={title}
                                layout="fill"
                                objectFit="cover"
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
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* View all results option for navbar */}
                  <div className="border-t border-border">
                    <button
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
