"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  ArrowDownWideNarrow,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  SlidersHorizontal,
} from "lucide-react";
import { useDiscoverMultiSelect } from "@/hooks/useDiscoverMultiSelect";
import { useFilters } from "@/hooks/useFilters";
import { useSort } from "@/hooks/useSort";
import { languages } from "@/lib/languages";
import { cn, joiner } from "@/lib/utils";
import type { Genre } from "@/tmdb/models";
import { WatchProvider } from "@/tmdb/models";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ProviderLogo } from "@/components/provider/provider";
import { InfoTooltip } from "@/components/shared/info-tooltip";

// --- discover-filter-date.tsx ---

interface DiscoverFilterDateProps {
  value: string;
  disableBefore?: string;
  disableAfter?: string;
  align: "start" | "end" | "center";
  label: string;
  onChange: (value: string) => void;
}

const parseIsoLocalDate = (value: string): Date | undefined => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const monthNames = Array.from({ length: 12 }, (_, index) =>
  format(new Date(2026, index, 1), "MMMM"),
);

const createMonthDate = (year: number, month: number, currentDate: Date) => {
  const day = Math.min(
    currentDate.getDate(),
    new Date(year, month + 1, 0).getDate(),
  );
  return new Date(year, month, day);
};

export const DiscoverFilterDate: React.FC<DiscoverFilterDateProps> = ({
  value,
  align,
  label,
  disableBefore,
  disableAfter,
  onChange,
}) => {
  const selected = value ? parseIsoLocalDate(value) : undefined;
  const from = disableBefore ? parseIsoLocalDate(disableBefore) : undefined;
  const to = disableAfter ? parseIsoLocalDate(disableAfter) : undefined;
  const fromDate = from ?? new Date(1900, 0, 1);
  const toDate = to ?? new Date(2050, 11, 31);
  const [displayMonth, setDisplayMonth] = React.useState<Date>(
    selected ?? new Date(),
  );

  React.useEffect(() => {
    if (selected) {
      setDisplayMonth(selected);
    }
  }, [selected]);

  const years = React.useMemo(
    () =>
      Array.from(
        { length: toDate.getFullYear() - fromDate.getFullYear() + 1 },
        (_, index) => fromDate.getFullYear() + index,
      ),
    [fromDate, toDate],
  );

  const disabled = {
    after: toDate,
    before: fromDate,
  };

  const setSelectedDate = (date?: Date) => {
    onChange(date ? format(date, "yyyy-MM-dd") : "");
  };

  const handleMonthChange = (month: string) => {
    setDisplayMonth(
      createMonthDate(
        displayMonth.getFullYear(),
        Number.parseInt(month, 10),
        displayMonth,
      ),
    );
  };

  const handleYearChange = (year: string) => {
    setDisplayMonth(
      createMonthDate(
        Number.parseInt(year, 10),
        displayMonth.getMonth(),
        displayMonth,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="flex text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {value && selected && !Number.isNaN(selected.getTime()) ? (
              format(selected, "PP")
            ) : (
              <span>Select date...</span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent align={align} className="w-auto p-3">
          <div className="mb-3 grid grid-cols-[1fr_5.5rem] gap-2">
            <Select
              value={String(displayMonth.getMonth())}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue aria-label={monthNames[displayMonth.getMonth()]} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {monthNames.map((month, index) => (
                    <SelectItem key={month} value={String(index)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={String(displayMonth.getFullYear())}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectGroup>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Calendar
            mode="single"
            selected={selected}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            fromDate={fromDate}
            toDate={toDate}
            disabled={disabled}
            onSelect={setSelectedDate}
            className="p-0"
            classNames={{ caption: "sr-only", nav: "hidden" }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

// --- discover-filter-genre.tsx ---

interface DiscoverFilterGenreProps {
  value: string;
  genres: Genre[];
  onChange: (value: string) => void;
}

export const DiscoverFilterGenre: React.FC<DiscoverFilterGenreProps> = ({
  value,
  genres,
  onChange,
}) => {
  const [matchMode, setMatchMode] = React.useState<"or" | "and">(() =>
    value.includes(",") && !value.includes("|") ? "and" : "or",
  );
  const selectedIds = React.useMemo(
    () =>
      value
        .split(/[|,]/)
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((n) => !Number.isNaN(n)),
    [value],
  );
  const { selection, toggleSelection } = useDiscoverMultiSelect({
    value,
    logic: matchMode,
    onChange,
  });

  React.useEffect(() => {
    setMatchMode(value.includes(",") && !value.includes("|") ? "and" : "or");
  }, [value]);

  const handleMatchModeChange = (nextMode: string) => {
    if (nextMode !== "or" && nextMode !== "and") return;
    setMatchMode(nextMode);
    const separator = nextMode === "and" ? "," : "|";
    onChange(selectedIds.length ? selectedIds.join(separator) : "");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-muted-foreground">Genres</Label>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Match</span>
          <InfoTooltip className="max-w-64">
            Any includes titles matching at least one selected genre. All only
            includes titles matching every selected genre.
          </InfoTooltip>
          <ToggleGroup
            type="single"
            value={matchMode}
            onValueChange={handleMatchModeChange}
            className="h-8 rounded-md border border-border/70 bg-background/50 p-0.5"
          >
            <ToggleGroupItem value="or" className="h-7 px-2 text-xs">
              Any
            </ToggleGroupItem>
            <ToggleGroupItem value="and" className="h-7 px-2 text-xs">
              All
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {genres.map((genre) => {
          const id = Number(genre.id);
          const isSelected = selection.includes(id);
          return (
            <button
              key={genre.id}
              type="button"
              onClick={() => toggleSelection(id)}
              aria-pressed={isSelected}
              className={cn(
                badgeVariants({
                  variant: isSelected ? "default" : "secondary",
                }),
                isSelected &&
                  "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
              )}
            >
              {genre.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- discover-filter-lang.tsx ---

interface DiscoverFilterLangProps {
  value: string;
  onChange: (value: string) => void;
}

export const DiscoverFilterLang: React.FC<DiscoverFilterLangProps> = ({
  value,
  onChange,
}) => {
  const selected = languages.find(
    (lang) => lang.iso_639_1 === value,
  )?.english_name;

  return (
    <div className="space-y-2">
      <Label className="flex text-muted-foreground">Language</Label>

      <Popover>
        <PopoverTrigger
          className={cn(value ? "text-foreground" : "text-muted-foreground")}
          asChild
        >
          <Button
            className="w-full justify-between text-left"
            variant="outline"
          >
            {selected || "Select language..."}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-64 p-0 md:w-80">
          <LanguageList value={value} onSelect={onChange} />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const LanguageList = ({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (value: string) => void;
}) => {
  return (
    <Command>
      <CommandInput placeholder="Search.." />
      <CommandList>
        <CommandEmpty>No results found</CommandEmpty>
        <CommandGroup>
          <ScrollArea className="max-h-40 overflow-y-auto">
            <LanguageOption value="" onSelect={onSelect} selected={!value}>
              All
            </LanguageOption>

            {languages.map((lang) => (
              <LanguageOption
                key={lang.iso_639_1}
                value={lang.iso_639_1}
                onSelect={onSelect}
                selected={value === lang.iso_639_1}
              >
                {lang.english_name}
              </LanguageOption>
            ))}
          </ScrollArea>
        </CommandGroup>
      </CommandList>
    </Command>
  );
};

export const LanguageOption = ({
  value,
  children,
  selected,
  onSelect,
}: {
  value: string;
  children: string;
  selected: boolean;
  onSelect: (value: string) => void;
}) => {
  return (
    <CommandItem value={children} key={value} onSelect={() => onSelect(value)}>
      <Check
        className={cn("mr-2 size-4", selected ? "opacity-100" : "opacity-0")}
      />

      {children}
    </CommandItem>
  );
};

// --- discover-filter-vote-average.tsx ---

interface DiscoverFilterVoteAverageProps {
  value: string;
  onChange: (value: string) => void;
}

export const DiscoverFilterVoteAverage: React.FC<
  DiscoverFilterVoteAverageProps
> = ({ value: initialValue, onChange }) => {
  const fromProps = initialValue ? parseInt(initialValue, 10) : 0;
  const [local, setLocal] = React.useState(fromProps);

  React.useEffect(() => {
    setLocal(fromProps);
  }, [fromProps]);

  const handleValueCommit = (value: number[]) => {
    onChange(value[0] !== undefined ? String(value[0]) : "");
  };

  return (
    <div className="space-y-4">
      <Label className="text-muted-foreground">Vote Average</Label>

      <Slider
        min={0}
        max={10}
        step={1}
        value={[local]}
        onValueChange={(v) => setLocal(v[0] ?? 0)}
        onValueCommit={handleValueCommit}
      />

      <div className="mt-4 flex justify-between border-t">
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} className="relative pt-2">
            <span
              className={cn(
                "text-[9px]",
                local !== i && "text-muted-foreground",
              )}
            >
              {i}
            </span>
            <span className="absolute left-1/2 top-0 block h-1/3 w-px -translate-x-px bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
};

// --- discover-filter-vote-count.tsx ---

interface DiscoverFilterVoteCountProps {
  value: string;
  onChange: (value: string) => void;
}

export const DiscoverFilterVoteCount: React.FC<
  DiscoverFilterVoteCountProps
> = ({ value: initialValue, onChange }) => {
  const fromProps = initialValue ? parseInt(initialValue, 10) : 0;
  const [local, setLocal] = React.useState(fromProps);

  React.useEffect(() => {
    setLocal(fromProps);
  }, [fromProps]);

  const handleValueCommit = (value: number[]) => {
    onChange(value[0] !== undefined ? String(value[0]) : "");
  };

  return (
    <div className="space-y-4">
      <Label className="text-muted-foreground">Minimum Votes</Label>

      <Slider
        min={0}
        max={500}
        step={500 / 10}
        value={[local]}
        onValueChange={(v) => setLocal(v[0] ?? 0)}
        onValueCommit={handleValueCommit}
      />

      <div className="mt-4 flex justify-between border-t">
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} className="relative pt-2">
            <span
              className={cn(
                "text-[9px]",
                local !== i * 50 && "text-muted-foreground",
              )}
            >
              {i * 50}
            </span>
            <span className="absolute left-1/2 top-0 block h-1/3 w-px bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
};

// --- discover-filter-provider.tsx ---

interface DiscoverFilterProviderProps {
  value: string;
  providers: WatchProvider[];
  onChange: (value: string) => void;
}

export const DiscoverFilterProvider: React.FC<DiscoverFilterProviderProps> = ({
  value,
  providers,
  onChange,
}) => {
  const { selection, toggleSelection, clearSelection } = useDiscoverMultiSelect(
    {
      value,
      logic: "or",
      onChange,
    },
  );

  const selectedProviders = selection.map((id: number) => {
    return providers.find((item) => item.provider_id === id);
  });

  const comboboxValue = value
    ? joiner(selectedProviders, "provider_name")
    : "Select providers...";

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-muted-foreground">
        Where to watch
        <InfoTooltip className="w-60">
          Provider filters use the US catalog from TMDb (fixed region, not based
          on your location).
        </InfoTooltip>
      </Label>
      <Popover>
        <PopoverTrigger
          className={cn(value ? "text-foreground" : "text-muted-foreground")}
          role="combobox"
          asChild
        >
          <Button
            variant="outline"
            className="w-full justify-between text-left"
          >
            <span className="line-clamp-1">{comboboxValue}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-64 p-0 md:w-80">
          <ProviderList
            providers={providers}
            selection={selection}
            toggleSelection={toggleSelection}
            clearSelection={clearSelection}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

const ProviderItem = ({
  provider,
  selected,
  toggleSelection,
}: {
  provider: WatchProvider;
  selected: boolean;
  toggleSelection: (value: number) => void;
}) => {
  const { provider_id: id, provider_name: name, logo_path: logo } = provider;

  return (
    <CommandItem key={id} value={name} onSelect={() => toggleSelection(id)}>
      <Check
        className={cn("mr-2 size-4", selected ? "opacity-100" : "opacity-0")}
      />

      <span className="relative mr-2 size-4">
        <ProviderLogo
          image={logo}
          alt={name}
          className="rounded-md"
          size="w45"
        />
      </span>

      {name}
    </CommandItem>
  );
};

const ProviderList = ({
  providers,
  selection,
  toggleSelection,
  clearSelection,
}: {
  providers: WatchProvider[];
  selection: number[];
  toggleSelection: (value: number) => void;
  clearSelection: () => void;
}) => {
  const selectedFirst = (a: WatchProvider, b: WatchProvider) => {
    const isSelectedA = selection.includes(a.provider_id) ? -1 : 1;
    const isSelectedB = selection.includes(b.provider_id) ? -1 : 1;
    const compareName = a.provider_name.localeCompare(b.provider_name);
    return isSelectedA - isSelectedB || compareName;
  };

  return (
    <Command>
      <CommandInput placeholder="Search providers..." />
      <CommandList>
        <CommandEmpty>No provider found.</CommandEmpty>

        <CommandGroup>
          <ScrollArea className="max-h-40 overflow-y-auto">
            {providers.sort(selectedFirst).map((provider) => (
              <ProviderItem
                key={provider.provider_id}
                provider={provider}
                selected={selection.includes(provider.provider_id)}
                toggleSelection={toggleSelection}
              />
            ))}
          </ScrollArea>
        </CommandGroup>

        {selection.length > 0 && (
          <CommandGroup className="border-t bg-background">
            <CommandItem
              className="justify-center"
              onSelect={() => clearSelection()}
            >
              Clear selection
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
};

// --- discover-filters.tsx ---

interface DiscoverFiltersProps {
  type: "movie" | "tv";
  genres: Genre[];
  providers: WatchProvider[];
  serverDiscoverFilters?: Record<string, string>;
}

export const DiscoverFilters: React.FC<DiscoverFiltersProps> = ({
  type,
  genres,
  providers,
  serverDiscoverFilters,
}) => {
  const {
    count,
    getFilter,
    setFilter,
    saveFilters,
    clearFilters,
    resetDraftFromUrl,
  } = useFilters(type, serverDiscoverFilters);

  const dateGte =
    type === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
  const dateLte =
    type === "movie" ? "primary_release_date.lte" : "first_air_date.lte";

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open) {
          resetDraftFromUrl();
        }
      }}
    >
      <SheetTrigger className={cn(buttonVariants({ variant: "outline" }))}>
        <SlidersHorizontal className="mr-2 size-4" /> Filters
        {count > 0 && (
          <Badge className="ml-2 px-2 text-xs leading-none">{count}</Badge>
        )}
      </SheetTrigger>

      <SheetContent className="flex flex-col px-0">
        <SheetHeader>
          <div className="px-4 md:px-6">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Narrow down your search results with the following filters.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea>
          <div className="space-y-8 px-4 md:px-6">
            <DiscoverFilterGenre
              genres={genres}
              value={getFilter("with_genres")}
              onChange={(value) => setFilter({ with_genres: value })}
            />

            <div className="grid gap-2 md:grid-cols-2">
              <DiscoverFilterDate
                label="From"
                align="start"
                value={getFilter(dateGte)}
                disableAfter={getFilter(dateLte)}
                onChange={(value) => setFilter({ [dateGte]: value })}
              />

              <DiscoverFilterDate
                label="To"
                align="end"
                value={getFilter(dateLte)}
                disableBefore={getFilter(dateGte)}
                onChange={(value) => setFilter({ [dateLte]: value })}
              />
            </div>

            <DiscoverFilterLang
              value={getFilter("with_original_language")}
              onChange={(value) => setFilter({ with_original_language: value })}
            />

            <DiscoverFilterProvider
              providers={providers}
              value={getFilter("with_watch_providers")}
              onChange={(value) => setFilter({ with_watch_providers: value })}
            />

            <DiscoverFilterVoteAverage
              value={getFilter("vote_average.gte")}
              onChange={(value) => setFilter({ "vote_average.gte": value })}
            />

            <DiscoverFilterVoteCount
              value={getFilter("vote_count.gte")}
              onChange={(value) => setFilter({ "vote_count.gte": value })}
            />
          </div>
        </ScrollArea>

        <SheetFooter className="gap-2 px-4 md:gap-0 md:px-6">
          <Button size="lg" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
          <SheetClose className={buttonVariants()} onClick={saveFilters}>
            Save Changes
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
// --- discover-sort.tsx ---

interface DiscoverSortProps {
  type: "movie" | "tv";
}

export const DiscoverSort: React.FC<DiscoverSortProps> = ({ type }) => {
  const { options, getSort, setSort } = useSort(type);
  const activeSort = getSort();
  const activeOption =
    options.find((option) => option.value === activeSort) ?? options[0];

  return (
    <Popover>
      <PopoverTrigger className={buttonVariants({ variant: "outline" })}>
        <ArrowDownWideNarrow className="mr-2 size-4" />
        <span>Sort: {activeOption?.label ?? "Most Popular"}</span>
      </PopoverTrigger>

      <PopoverContent align="end" className="flex flex-col gap-1 p-1">
        {options.map((option) => (
          <Button
            key={option.value}
            variant={getSort() === option.value ? "default" : "ghost"}
            onClick={() => setSort(option.value)}
            className="justify-between text-left font-normal"
          >
            <span className="flex items-center">
              <option.icon className="mr-2 size-4" /> {option.label}
            </span>

            {option.value.includes("asc") ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
