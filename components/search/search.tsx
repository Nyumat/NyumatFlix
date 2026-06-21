"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useSearchAutocomplete,
  shouldKeepSearchFocusWithinContainer,
} from "@/hooks/use-search-autocomplete";
import { useSearchPreview } from "@/hooks/use-search-preview";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clock3, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  getSearchResultHref,
  SearchAutocomplete,
  type SearchAutocompleteFooter,
  type SearchAutocompleteSelection,
} from "./search-autocomplete";
import SearchResults from "./search-results";

interface SearchComponentProps {
  onSearch?: (query: string) => void;
}

interface SearchExperienceProps {
  initialQuery?: string;
  onSubmit?: (query: string) => void;
  onAfterNavigation?: () => void;
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

const SEARCH_FORM_CLASSNAME =
  "relative max-w-sm md:max-w-lg mx-auto md:scale-150";
const SEARCH_INPUT_CLASSNAME =
  "bg-black/30 backdrop-blur-md border-white/20 focus:border-primary focus:bg-black/40 shadow-xl";

const SEARCH_DIALOG_SPRING = {
  type: "spring" as const,
  stiffness: 320,
  damping: 32,
  mass: 0.9,
};

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
      formClassName={SEARCH_FORM_CLASSNAME}
      inputClassName={SEARCH_INPUT_CLASSNAME}
    />
  );
}

function SearchExperience({
  initialQuery = "",
  onSubmit,
  onAfterNavigation,
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
  const [isClearRecentsDialogOpen, setIsClearRecentsDialogOpen] =
    useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [_isMouseOverResults, setIsMouseOverResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isDialog = variant === "dialog";
  const autocompleteFooter: SearchAutocompleteFooter = isDialog
    ? "view-all"
    : "none";
  const showCommittedResults =
    Boolean(searchQuery.trim()) && query.trim() === searchQuery.trim();
  const { results, suggestions, isLoading } = useSearchPreview(query);
  const showAutocomplete =
    isFocused && query.trim().length >= 2 && !showCommittedResults;

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

  const handleAutocompleteSelect = useCallback(
    (selection: SearchAutocompleteSelection) => {
      if (selection.type === "suggestion") {
        const trimmedQuery = selection.value.trim();
        setQuery(trimmedQuery);
        setSearchQuery(trimmedQuery);
        if (isDialog) {
          saveRecentSearch(trimmedQuery);
        }
        onSubmit?.(trimmedQuery);
        return;
      }

      if (selection.type === "result") {
        onAfterNavigation?.();
        router.push(getSearchResultHref(selection.value));
        return;
      }

      handleSearch();
    },
    [
      handleSearch,
      isDialog,
      onAfterNavigation,
      onSubmit,
      router,
      saveRecentSearch,
    ],
  );

  const {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown: handleAutocompleteKeyDown,
    handleOptionKeyDown,
    handleInputFocus,
    listboxId,
    comboboxInputProps,
  } = useSearchAutocomplete({
    query,
    results,
    suggestions,
    isOpen: showAutocomplete,
    footer: autocompleteFooter,
    ariaLabel: placeholder,
    inputRef,
    onSelect: handleAutocompleteSelect,
    onClose: () => setIsFocused(false),
    onBlurInput: () => inputRef.current?.blur(),
  });

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
    if (!showAutocomplete) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAutocomplete]);

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
        isDialog ? "h-full min-h-0 max-h-full overflow-hidden gap-4" : "gap-8",
      )}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      {isDialog && (
        <div className="mx-auto flex w-full max-w-xl shrink-0 items-center justify-between gap-4">
          {showCommittedResults ? (
            <motion.p
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
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
        className={cn(isDialog && "shrink-0")}
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <motion.div
          ref={containerRef}
          className={cn(
            isDialog
              ? "relative mx-auto w-full max-w-xl"
              : "relative mx-auto max-w-sm md:max-w-lg",
            formClassName,
          )}
        >
          <div className="relative">
            <Search
              className={cn(
                "absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground",
                iconClassName,
              )}
            />
            <Input
              ref={inputRef}
              type="search"
              placeholder={placeholder}
              value={query}
              autoComplete="off"
              {...comboboxInputProps}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                setIsFocused(true);
                handleInputFocus();
              }}
              onBlur={(event) => {
                if (
                  shouldKeepSearchFocusWithinContainer(
                    event,
                    containerRef.current,
                  )
                ) {
                  return;
                }
                setIsFocused(false);
              }}
              onKeyDown={(e) => {
                if (handleAutocompleteKeyDown(e)) {
                  return;
                }

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
                aria-label="Search"
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
          </div>

          {showAutocomplete && (
            <AnimatePresence initial={false}>
              <motion.div
                key="search-autocomplete-panel"
                initial={isDialog ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={isDialog ? { opacity: 0, y: 6 } : undefined}
                transition={
                  isDialog
                    ? SEARCH_DIALOG_SPRING
                    : { duration: 0.15, ease: "easeOut" }
                }
              >
                <SearchAutocomplete
                  query={query}
                  results={results}
                  suggestions={suggestions}
                  isLoading={isLoading}
                  selectedIndex={selectedIndex}
                  footer={autocompleteFooter}
                  listboxId={listboxId}
                  placement={isDialog ? "panel" : "popover"}
                  onMouseEnter={() => setIsMouseOverResults(true)}
                  onMouseLeave={() => setIsMouseOverResults(false)}
                  onOptionHover={setSelectedIndex}
                  onOptionKeyDown={handleOptionKeyDown}
                  onSelectSuggestion={(suggestion) =>
                    handleAutocompleteSelect({
                      type: "suggestion",
                      value: suggestion,
                    })
                  }
                  onSelectResult={(result) =>
                    handleAutocompleteSelect({ type: "result", value: result })
                  }
                  onFooterAction={handleSearch}
                  onPrefetchResult={(href) => router.prefetch(href)}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </form>

      {isDialog &&
        !showCommittedResults &&
        !showAutocomplete &&
        query.trim().length === 0 &&
        recentSearches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="mx-auto w-full max-w-xl shrink-0"
          >
            <div className="mb-3 flex items-center justify-between px-1.5">
              <p className="text-sm font-medium text-muted-foreground">
                Recent
              </p>
              <button
                type="button"
                onClick={() => setIsClearRecentsDialogOpen(true)}
                className="text-sm text-muted-foreground transition-colors hover:text-white"
              >
                Clear
              </button>
            </div>
            <div
              className="space-y-1.5"
              role="list"
              aria-label="Recent searches"
            >
              {recentSearches.map((recentSearch) => (
                <button
                  type="button"
                  role="listitem"
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

      {isDialog && (
        <AlertDialog
          open={isClearRecentsDialogOpen}
          onOpenChange={setIsClearRecentsDialogOpen}
        >
          <AlertDialogContent className="z-[60]">
            <AlertDialogHeader>
              <AlertDialogTitle>Clear recent searches?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes your recent searches from this device. You
                can&apos;t undo this action.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  clearRecentSearches();
                }}
              >
                Clear
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AnimatePresence mode="wait">
        {showCommittedResults && (
          <motion.div
            key={searchQuery}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              isDialog && "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            )}
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
      <DialogPortal>
        <DialogOverlay className="bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[15vh] z-50 flex w-[min(100%-2rem,48rem)] max-h-[min(74vh,900px)] -translate-x-1/2 flex-col overflow-hidden border-0 bg-transparent p-5 shadow-none outline-none sm:p-7",
            "duration-300 ease-out",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:slide-in-from-bottom-10 data-[state=closed]:slide-out-to-bottom-6",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=closed]:slide-out-to-left-1/2",
          )}
        >
          <DialogDescription className="sr-only">
            Search movies and TV shows without leaving the current page.
          </DialogDescription>
          <SearchExperience
            autoFocus={open}
            variant="dialog"
            onAfterNavigation={() => onOpenChange(false)}
            formClassName="max-w-xl md:max-w-xl"
            iconClassName="left-4 size-5 text-muted-foreground"
            inputClassName="h-14 rounded-2xl border-white/10 bg-black/55 pl-12 pr-16 text-lg shadow-none backdrop-blur-xl placeholder:text-muted-foreground/75 focus-visible:border-white/20 focus-visible:bg-black/65 focus-visible:ring-1 focus-visible:ring-white/10 focus-visible:ring-offset-0"
            placeholder="Type here to search..."
            submitButtonClassName="right-2 size-8 bg-white/10 text-muted-foreground hover:bg-white/15 hover:text-white md:size-8"
            submitIconClassName="size-5 md:size-5"
          />
        </DialogPrimitive.Content>
      </DialogPortal>
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
  const [isFocused, setIsFocused] = useState(false);
  const [_isMouseOverResults, setIsMouseOverResults] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const innerRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const inputRef = (ref as React.RefObject<HTMLInputElement>) || innerRef;

  const { results, suggestions, isLoading } = useSearchPreview(query);
  const showAutocomplete = isFocused && query.trim().length >= 2;

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      onAfterNavigation?.();
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, router, onAfterNavigation]);

  const handleAutocompleteSelect = useCallback(
    (selection: SearchAutocompleteSelection) => {
      if (selection.type === "suggestion") {
        const trimmedQuery = selection.value.trim();
        setQuery(trimmedQuery);
        onAfterNavigation?.();
        router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
        return;
      }

      if (selection.type === "result") {
        onAfterNavigation?.();
        router.push(getSearchResultHref(selection.value));
        return;
      }

      handleSearch();
    },
    [handleSearch, onAfterNavigation, router],
  );

  const {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown: handleAutocompleteKeyDown,
    handleOptionKeyDown,
    handleInputFocus,
    listboxId,
    comboboxInputProps,
  } = useSearchAutocomplete({
    query,
    results,
    suggestions,
    isOpen: showAutocomplete,
    footer: "go-to-search",
    ariaLabel: "Search movies and TV shows",
    inputRef,
    onSelect: handleAutocompleteSelect,
    onClose: () => setIsFocused(false),
    onBlurInput: () => inputRef.current?.blur(),
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!showAutocomplete) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAutocomplete]);

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

  return (
    <div
      className={cn("max-w-xl grow mx-auto md:max-w-2xl", className)}
      suppressHydrationWarning
    >
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search..."
            autoComplete="off"
            suppressHydrationWarning
            {...comboboxInputProps}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              handleInputFocus();
            }}
            onBlur={(event) => {
              if (
                shouldKeepSearchFocusWithinContainer(
                  event,
                  containerRef.current,
                )
              ) {
                return;
              }
              setIsFocused(false);
            }}
            onKeyDown={(e) => {
              if (handleAutocompleteKeyDown(e)) {
                return;
              }

              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="pl-8 pr-20 py-2 text-sm w-full rounded-full border border-border/30 bg-background/60 shadow-sm backdrop-blur-md transition-all hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:border-border/30 focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-white/15 dark:bg-black/40 dark:hover:bg-white/15 dark:focus-visible:bg-white/15 placeholder:text-muted-foreground/55"
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
                aria-label="Search"
                onClick={handleSearch}
                className="p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                disabled={!query.trim()}
              >
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        {showAutocomplete && (
          <SearchAutocomplete
            query={query}
            results={results}
            suggestions={suggestions}
            isLoading={isLoading}
            selectedIndex={selectedIndex}
            footer="go-to-search"
            listboxId={listboxId}
            onMouseEnter={() => setIsMouseOverResults(true)}
            onMouseLeave={() => setIsMouseOverResults(false)}
            onOptionHover={setSelectedIndex}
            onOptionKeyDown={handleOptionKeyDown}
            onSelectSuggestion={(suggestion) =>
              handleAutocompleteSelect({
                type: "suggestion",
                value: suggestion,
              })
            }
            onSelectResult={(result) =>
              handleAutocompleteSelect({ type: "result", value: result })
            }
            onFooterAction={handleSearch}
            onPrefetchResult={(href) => router.prefetch(href)}
          />
        )}
      </div>
    </div>
  );
});

NavbarSearchClient.displayName = "NavbarSearchClient";
