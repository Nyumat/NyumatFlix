"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon } from "lucide-react";

export function SearchComponent() {
  const existingQuery = useSearchParams().get("query");
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?query=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form
      onSubmit={handleSearch}
      className="flex w-full items-center space-x-14"
    >
      <Input
        type="text"
        placeholder={
          existingQuery
            ? existingQuery
            : "Search for movies, TV shows, and more"
        }
        className="min-w-full scale-125"
        value={existingQuery ?? query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Button type="submit">
        <SearchIcon className="h-4 w-4 mr-2" />
        Search
      </Button>
    </form>
  );
}
