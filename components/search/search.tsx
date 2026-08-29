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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useSearchKeyboardShortcuts } from "@/hooks/use-search-keyboard-shortcuts";
import { useSearchRecents } from "@/hooks/use-search-recents";
import { useSearchPreview } from "@/hooks/use-search-preview";
import { useAdblockGateAction } from "@/components/providers/adblock-gate-provider";
import { useSearchDialogStore } from "@/lib/stores/search-dialog-store";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Search, X } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  getSearchResultHref,
  SearchAutocomplete,
  type SearchAutocompleteFooter,
  type SearchAutocompleteSelection,
} from "./search-autocomplete";
import { SearchDialogEmpty } from "./search-dialog-empty";
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
  placeholder?: string;
  autoFocus?: boolean;
  variant?: "page" | "dialog";
  onResultsVisibleChange?: (hasResults: boolean) => void;
}

const SEARCH_FORM_CLASSNAME = "relative mx-auto w-full max-w-2xl";
const SEARCH_INPUT_CLASSNAME =
  "border-white/10 bg-white/[0.04] shadow-none backdrop-blur-sm placeholder:text-muted-foreground/70 focus-visible:border-white/15 focus-visible:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-white/10 focus-visible:ring-offset-0";

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

  useSearchKeyboardShortcuts({
    inputRef,
    focusOnSlash: true,
    focusOnPrintable: true,
    onEscape: () => setIsFocused(false),
  });

  return (
    <div className="relative w-full max-w-lg mx-auto" suppressHydrationWarning>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search movies, TV shows, and anime..."
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
  const gateAction = useAdblockGateAction();

  return (
    <SearchExperience
      key={urlQuery}
      initialQuery={urlQuery}
      onSubmit={(trimmedQuery) => {
        gateAction(() => {
          router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
        });
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
  placeholder = "Search movies, TV, and anime...",
  autoFocus = false,
  variant = "page",
  onResultsVisibleChange,
}: SearchExperienceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isClearRecentsDialogOpen, setIsClearRecentsDialogOpen] =
    useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDialog = variant === "dialog";
  const { recentSearches, saveRecentSearch, clearRecentSearches } =
    useSearchRecents(true);
  const debouncedQuery = useDebouncedValue(query, 300);
  const activeResultsQuery = debouncedQuery.trim();
  const showResults = activeResultsQuery.length >= 2;
  const showEmptyState = !showResults && query.trim().length === 0;

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      const trimmedQuery = query.trim();
      saveRecentSearch(trimmedQuery);
      onSubmit?.(trimmedQuery);
    }
  }, [query, onSubmit, saveRecentSearch]);

  const handleRecentSearch = useCallback(
    (recentSearch: string) => {
      setQuery(recentSearch);
      saveRecentSearch(recentSearch);
      onSubmit?.(recentSearch);
    },
    [onSubmit, saveRecentSearch],
  );

  useEffect(() => {
    onResultsVisibleChange?.(showResults);
  }, [onResultsVisibleChange, showResults]);

  useEffect(() => {
    if (autoFocus) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [autoFocus]);

  useSearchKeyboardShortcuts({
    inputRef,
    focusOnModK: true,
    focusOnSlash: !isDialog,
  });

  return (
    <motion.div
      className={cn(
        "w-full flex flex-col",
        isDialog ? "h-full min-h-0 max-h-full overflow-hidden gap-3" : "gap-6",
      )}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      {isDialog && (
        <div className="mx-auto flex w-full max-w-none shrink-0 items-center justify-between gap-4 px-1">
          {showResults ? (
            <motion.p
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-base text-muted-foreground"
            >
              Results for{" "}
              <span className="text-lg font-semibold text-foreground">
                &quot;{activeResultsQuery}&quot;
              </span>
            </motion.p>
          ) : (
            <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
              Search
            </DialogTitle>
          )}
          <DialogClose className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-white/15 hover:bg-white/[0.08] hover:text-white focus:outline-hidden focus:ring-1 focus:ring-white/20">
            <X className="size-4" />
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
          className={cn(
            isDialog
              ? "relative w-full"
              : "relative mx-auto max-w-sm md:max-w-lg",
            formClassName,
          )}
        >
          <div className="relative">
            <Search
              className={cn(
                "absolute top-1/2 z-10 -translate-y-1/2 text-muted-foreground",
                isDialog ? "left-3.5 size-4" : "left-3.5 size-4",
                iconClassName,
              )}
            />
            <Input
              ref={inputRef}
              type="search"
              placeholder={placeholder}
              value={query}
              autoComplete="off"
              aria-label={placeholder}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className={cn(
                "w-full border text-base transition-all duration-200 placeholder:text-muted-foreground/60 text-foreground",
                isDialog
                  ? "h-12 rounded-md pl-10 pr-10 text-base [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                  : "h-12 rounded-md pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
                inputClassName,
              )}
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </motion.div>
      </form>

      {showEmptyState && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SEARCH_DIALOG_SPRING}
          className={cn(
            "mx-auto w-full max-w-none shrink-0",
            !isDialog && "max-w-2xl",
          )}
        >
          <SearchDialogEmpty
            recentSearches={recentSearches}
            onSelectQuery={handleRecentSearch}
            onClearRecents={
              recentSearches.length > 0
                ? () => setIsClearRecentsDialogOpen(true)
                : undefined
            }
          />
        </motion.div>
      )}

      <AlertDialog
        open={isClearRecentsDialogOpen}
        onOpenChange={setIsClearRecentsDialogOpen}
      >
        <AlertDialogContent className={cn(isDialog && "z-[60]")}>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear recent searches?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your recent searches from this device. You can&apos;t
              undo this action.
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

      <AnimatePresence mode="wait">
        {showResults && (
          <motion.div
            key={activeResultsQuery}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              isDialog && "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            )}
          >
            <SearchResults
              query={activeResultsQuery}
              hideTitle={isDialog}
              onNavigate={isDialog ? onAfterNavigation : undefined}
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
  const [hasVisibleResults, setHasVisibleResults] = useState(false);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const setSearchDialogOpen = useSearchDialogStore((state) => state.setIsOpen);

  const handleDialogOpenChange = useCallback(
    (next: boolean) => {
      setSearchDialogOpen(next);
      onOpenChange(next);
    },
    [onOpenChange, setSearchDialogOpen],
  );

  useEffect(() => {
    setSearchDialogOpen(open);
  }, [open, setSearchDialogOpen]);

  useEffect(() => {
    if (!open) {
      setHasVisibleResults(false);
    }
  }, [open]);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    onOpenChange(false);
  }, [pathname, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/70 backdrop-blur-md" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[8vh] z-50 flex -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-white/8 bg-[#09090b]/90 p-4 shadow-2xl shadow-black/50 outline-none backdrop-blur-xl sm:p-5",
            hasVisibleResults
              ? "w-[min(100%-1.5rem,68rem)] max-h-[min(88vh,940px)]"
              : "w-[min(100%-1.5rem,48rem)] max-h-[min(65vh,640px)]",
            "duration-300 ease-out",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-4",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=closed]:slide-out-to-left-1/2",
          )}
        >
          <DialogDescription className="sr-only">
            Search movies and TV shows without leaving the current page.
          </DialogDescription>
          <SearchExperience
            autoFocus={open}
            variant="dialog"
            onResultsVisibleChange={setHasVisibleResults}
            onAfterNavigation={() => onOpenChange(false)}
            formClassName="w-full"
            iconClassName="left-3.5 size-4 text-muted-foreground"
            inputClassName="border-white/10 bg-white/[0.04] shadow-none backdrop-blur-sm placeholder:text-muted-foreground/70 focus-visible:border-white/15 focus-visible:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-white/10 focus-visible:ring-offset-0"
            placeholder="Search movies, TV, and anime..."
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

export interface NavbarSearchClientProps {
  className?: string;
  onAfterNavigation?: () => void;
  onOpenDialog?: () => void;
  mode?: "inline" | "trigger";
}

export const NavbarSearchClient = forwardRef<
  HTMLInputElement,
  NavbarSearchClientProps
>(({ className, onAfterNavigation, onOpenDialog, mode = "inline" }, ref) => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const innerRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const gateAction = useAdblockGateAction();

  const inputRef = (ref as React.RefObject<HTMLInputElement>) || innerRef;

  const { results, isLoading, error: previewError } = useSearchPreview(query);
  const showAutocomplete = isFocused && query.trim().length >= 2;

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      gateAction(() => {
        onAfterNavigation?.();
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      });
    }
  }, [gateAction, query, router, onAfterNavigation]);

  const handleAutocompleteSelect = useCallback(
    (selection: SearchAutocompleteSelection) => {
      if (selection.type === "result") {
        onAfterNavigation?.();
        router.push(getSearchResultHref(selection.value));
        return;
      }

      handleSearch();
    },
    [gateAction, handleSearch, onAfterNavigation, router],
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

  useClickOutside(containerRef, showAutocomplete, () => setIsFocused(false));

  useSearchKeyboardShortcuts({
    inputRef,
    focusOnModK: true,
  });

  if (mode === "trigger") {
    return (
      <button
        type="button"
        onClick={() => {
          onAfterNavigation?.();
          onOpenDialog?.();
        }}
        className={cn(
          "flex h-11 w-full items-center gap-3 rounded-md border border-border/30 bg-background/60 px-4 text-left text-sm text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-muted/60 dark:border-white/15 dark:bg-black/40 dark:hover:bg-white/15",
          className,
        )}
        aria-label="Open search"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">Search movies, TV, people...</span>
        <kbd className="hidden rounded border border-border/30 bg-muted/20 px-1.5 py-0.5 text-[10px] sm:inline-block">
          ⌘K
        </kbd>
      </button>
    );
  }

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
            isLoading={isLoading}
            error={previewError}
            selectedIndex={selectedIndex}
            footer="go-to-search"
            listboxId={listboxId}
            onOptionFocus={setSelectedIndex}
            onOptionKeyDown={handleOptionKeyDown}
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
