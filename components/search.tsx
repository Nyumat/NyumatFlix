"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSearchPreview,
  type PreviewResult,
} from "@/hooks/use-search-preview";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Search as SearchIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import SearchResults from "./search-results";
import Image from "next/legacy/image";

export function SearchComponent({
  onSearch,
}: { onSearch?: (query: string) => void } = {}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  const { previewResults, isLoadingPreview } = useSearchPreview({
    query,
    disablePreview: false,
  });

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      setIsFocused(false);
      if (onSearch) onSearch(query.trim());
    }
  };

  const clearSearch = () => {
    setQuery("");
    setIsFocused(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
    if (onSearch) onSearch("");
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
    <div className="relative w-full max-w-3xl">
      <form onSubmit={handleSearch} className="relative" autoComplete="off">
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Just start typing..."
            className="pl-5 pr-20 py-6 text-base md:text-lg rounded-xl border border-border shadow-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center space-x-1">
            {query && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearSearch}
                className="h-8 w-8"
                type="button"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              type="submit"
              aria-label="Search"
              className="h-8 w-8"
              disabled={isLoadingPreview || !query.trim()}
            >
              <SearchIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>

      <AnimatePresence>
        {isFocused && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 z-[200]"
            ref={commandRef}
          >
            <Command className="rounded-xl border border-white/10 shadow-2xl bg-black/70 backdrop-blur-lg">
              {isLoadingPreview ? (
                <div className="p-4 flex flex-col space-y-3">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-md" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[100px]" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-md" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[150px]" />
                      <Skeleton className="h-3 w-[80px]" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <CommandList>
                    {previewResults.length === 0 && !isLoadingPreview ? (
                      <CommandEmpty>
                        No results found for &quot;{query}&quot;
                      </CommandEmpty>
                    ) : (
                      <CommandGroup heading="Results">
                        {previewResults.map((result: PreviewResult) => (
                          <CommandItem
                            key={`${result.id}-${result.media_type}`}
                            onSelect={() => {
                              const selectedValue =
                                result.title || result.name || "";
                              setQuery(selectedValue);
                              if (onSearch) onSearch(selectedValue);
                              setIsFocused(false);
                            }}
                            className="py-2 px-2 data-[selected='true']:bg-white/10 data-[selected=true]:text-white cursor-pointer"
                          >
                            <div className="flex items-center w-full">
                              <div className="w-12 h-16 relative flex-shrink-0 mr-4 overflow-hidden rounded-md bg-muted">
                                {result.poster_path ? (
                                  <Image
                                    width={48}
                                    height={72}
                                    src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                                    alt={
                                      result.title || result.name || "Poster"
                                    }
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                    No Image
                                  </div>
                                )}
                              </div>
                              <div className="flex-grow overflow-hidden">
                                <div className="font-medium truncate">
                                  {result.title || result.name}
                                </div>
                                <div className="text-xs text-muted-foreground capitalize">
                                  {result.media_type.replace("_", " ")}
                                </div>
                              </div>
                              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground flex-shrink-0" />
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                  {previewResults.length > 0 && (
                    <div className="p-2 border-t border-white/10 mt-1">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm text-muted-foreground hover:text-white"
                        onClick={() => handleSearch()}
                        disabled={!query.trim()}
                      >
                        <SearchIcon className="h-4 w-4 mr-2" /> See all results
                        for &quot;{query}&quot;
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Command>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SearchPageClient() {
  const [query, setQuery] = useState("");

  return (
    <>
      {/* Search Box Area - higher z-index to ensure dropdown visibility */}
      <div className="max-w-3xl w-full px-4 mb-12 relative z-50">
        <div className="bg-black/70 backdrop-blur-lg p-6 md:p-8 rounded-xl border border-white/10 shadow-2xl relative">
          <SearchComponent onSearch={setQuery} />
        </div>
      </div>

      {/* Search Results Area - lower z-index than search box */}
      {query && (
        <div className="w-full max-w-7xl mx-auto px-4 pb-12 z-10">
          <SearchResults query={query} />
        </div>
      )}
    </>
  );
}
