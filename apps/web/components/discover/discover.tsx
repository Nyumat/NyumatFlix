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
      <Label className="flex text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "h-11 w-full justify-start rounded-lg border-border/70 bg-background/45 px-3 text-left font-normal shadow-none",
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
  const derivedMatchMode =
    value.includes(",") && !value.includes("|") ? "and" : "or";
  const [matchMode, setMatchMode] = React.useState<"or" | "and">(
    derivedMatchMode,
  );
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setMatchMode(derivedMatchMode);
  }
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

  const handleMatchModeChange = (nextMode: string) => {
    if (nextMode !== "or" && nextMode !== "and") return;
    setMatchMode(nextMode);
    const separator = nextMode === "and" ? "," : "|";
    onChange(selectedIds.length ? selectedIds.join(separator) : "");
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold text-foreground">
            Genres
          </Label>
          {selection.length > 0 && (
            <Badge variant="secondary" className="px-2 py-0 text-[11px]">
              {selection.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <InfoTooltip className="max-w-64">
            Any includes titles matching at least one selected genre. All only
            includes titles matching every selected genre.
          </InfoTooltip>
          <ToggleGroup
            type="single"
            value={matchMode}
            onValueChange={handleMatchModeChange}
            aria-label="Genre matching"
            className="h-8 rounded-md border border-border/70 bg-background/45 p-0.5"
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

      <div className="flex flex-wrap gap-1.5">
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
                "min-h-8 px-3 py-1 text-sm shadow-none",
                isSelected &&
                  "border-primary/50 bg-primary/20 ring-1 ring-primary/45 ring-offset-0",
              )}
            >
              {genre.name}
            </button>
          );
        })}
      </div>
    </section>
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
    <section className="space-y-3">
      <Label className="flex text-sm font-semibold text-foreground">
        Language
      </Label>

      <Popover>
        <PopoverTrigger
          className={cn(value ? "text-foreground" : "text-muted-foreground")}
          asChild
        >
          <Button
            className="h-11 w-full justify-between rounded-lg border-border/70 bg-background/45 px-3 text-left shadow-none"
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
    </section>
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
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-semibold text-foreground">
          Minimum rating
        </Label>
        <span className="rounded-full border border-border/60 bg-background/45 px-2 py-0.5 text-xs text-muted-foreground">
          {local > 0 ? `${local}/10` : "Any"}
        </span>
      </div>

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
    </section>
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
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-semibold text-foreground">
          Minimum votes
        </Label>
        <span className="rounded-full border border-border/60 bg-background/45 px-2 py-0.5 text-xs text-muted-foreground">
          {local > 0 ? local : "Any"}
        </span>
      </div>

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
    </section>
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
    <section className="space-y-3">
      <Label className="flex items-center gap-2 text-sm font-semibold text-foreground">
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
            className="h-11 w-full justify-between rounded-lg border-border/70 bg-background/45 px-3 text-left shadow-none"
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
    </section>
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
  triggerClassName?: string;
}

type DiscoverFilterState = {
  count: number;
  getFilter: (key: string) => string;
  setFilter: (partial: Record<string, string>) => void;
  saveFilters: (options?: { sortBy?: string }) => void;
  clearFilters: () => void;
  resetDraftFromUrl: () => void;
};

type DiscoverSortOption = ReturnType<typeof useSort>["options"][number];

const getActiveSortOption = (
  options: DiscoverSortOption[],
  activeSort: string,
) => options.find((option) => option.value === activeSort) ?? options[0];

const DiscoverFilterSections = ({
  type,
  genres,
  providers,
  getFilter,
  setFilter,
}: {
  type: "movie" | "tv";
  genres: Genre[];
  providers: WatchProvider[];
  getFilter: DiscoverFilterState["getFilter"];
  setFilter: DiscoverFilterState["setFilter"];
}) => {
  const dateGte =
    type === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
  const dateLte =
    type === "movie" ? "primary_release_date.lte" : "first_air_date.lte";
  const dateLabel = type === "movie" ? "Release date" : "First air date";

  return (
    <div className="space-y-6">
      <DiscoverFilterGenre
        genres={genres}
        value={getFilter("with_genres")}
        onChange={(value) => setFilter({ with_genres: value })}
      />

      <section className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">
          {dateLabel}
        </Label>
        <div className="grid gap-3 sm:grid-cols-2">
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
      </section>

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
  );
};

const DiscoverSortOptions = ({
  options,
  activeSort,
  onSelect,
  className,
}: {
  options: DiscoverSortOption[];
  activeSort: string;
  onSelect: (value: string) => void;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-1", className)}>
    {options.map((option) => (
      <Button
        key={option.value}
        type="button"
        variant={activeSort === option.value ? "default" : "ghost"}
        onClick={() => onSelect(option.value)}
        className="justify-between text-left font-normal"
      >
        <span className="flex min-w-0 items-center">
          <option.icon className="mr-2 size-4 shrink-0" />
          <span className="truncate">{option.label}</span>
        </span>

        {option.value.includes("asc") ? (
          <ChevronUp className="ml-3 size-4 shrink-0" />
        ) : (
          <ChevronDown className="ml-3 size-4 shrink-0" />
        )}
      </Button>
    ))}
  </div>
);

export const DiscoverFilters: React.FC<DiscoverFiltersProps> = ({
  type,
  genres,
  providers,
  serverDiscoverFilters,
  triggerClassName,
}) => {
  const {
    count,
    getFilter,
    setFilter,
    saveFilters,
    clearFilters,
    resetDraftFromUrl,
  } = useFilters(type, serverDiscoverFilters);

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open) {
          resetDraftFromUrl();
        }
      }}
    >
      <SheetTrigger
        className={cn(buttonVariants({ variant: "outline" }), triggerClassName)}
      >
        <SlidersHorizontal className="mr-2 size-4" /> Filters
        {count > 0 && (
          <Badge className="ml-2 px-2 text-xs leading-none">{count}</Badge>
        )}
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col overflow-hidden bg-background p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border/60 px-4 pb-4 pt-5 text-left md:px-6">
          <div className="pr-10">
            <SheetTitle className="text-xl">Filters</SheetTitle>
            <SheetDescription>
              Narrow down your search results with the following filters.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-4 py-5 md:px-6">
            <DiscoverFilterSections
              type={type}
              genres={genres}
              providers={providers}
              getFilter={getFilter}
              setFilter={setFilter}
            />
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row gap-2 border-t border-border/60 bg-background px-4 py-4 shadow-[0_-12px_28px_rgba(0,0,0,0.22)] sm:space-x-0 md:px-6">
          <Button
            size="lg"
            variant="outline"
            onClick={clearFilters}
            className="flex-1 shadow-none"
          >
            Clear
          </Button>
          <SheetClose
            className={cn(buttonVariants({ size: "lg" }), "flex-1")}
            onClick={() => saveFilters()}
          >
            Save Changes
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export const DiscoverFilterSort: React.FC<DiscoverFiltersProps> = ({
  type,
  genres,
  providers,
  serverDiscoverFilters,
  triggerClassName,
}) => {
  const {
    count,
    getFilter,
    setFilter,
    saveFilters,
    clearFilters,
    resetDraftFromUrl,
  } = useFilters(type, serverDiscoverFilters);
  const { options, getSort } = useSort(type);
  const activeSort = getSort();
  const activeOption = getActiveSortOption(options, activeSort);
  const currentSortValue = activeOption?.value ?? options[0]?.value ?? "";
  const [draftSort, setDraftSort] = React.useState(currentSortValue);
  const draftOption = getActiveSortOption(options, draftSort);

  React.useEffect(() => {
    setDraftSort(currentSortValue);
  }, [currentSortValue]);

  const saveFilterSort = () => {
    saveFilters({ sortBy: draftSort });
  };

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open) {
          resetDraftFromUrl();
          setDraftSort(currentSortValue);
        }
      }}
    >
      <SheetTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-11 w-full justify-between gap-3 px-3 md:h-9 md:w-auto md:px-4",
          triggerClassName,
        )}
        aria-label={`Open filters and sort. Current sort: ${
          activeOption?.label ?? "Highest Popularity"
        }`}
      >
        <span className="flex min-w-0 items-center">
          <SlidersHorizontal className="mr-2 size-4 shrink-0" />
          <span>Filter &amp; Sort</span>
          {count > 0 && (
            <Badge className="ml-2 px-2 text-xs leading-none">{count}</Badge>
          )}
        </span>
        <span className="hidden min-w-0 items-center gap-1.5 border-l border-border/70 pl-3 text-xs font-medium text-foreground/70 md:flex">
          <ArrowDownWideNarrow className="size-3.5 shrink-0" />
          <span className="max-w-36 truncate">
            {activeOption?.label ?? "Highest Popularity"}
          </span>
        </span>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col overflow-hidden bg-background p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border/60 px-4 pb-4 pt-5 text-left md:px-6">
          <div className="pr-10">
            <SheetTitle className="text-xl">Filter &amp; Sort</SheetTitle>
            <SheetDescription>
              Choose an order, then narrow the catalog.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 px-4 py-5 md:px-6">
            <section className="grid gap-2 sm:grid-cols-[5rem_1fr] sm:items-center">
              <Label className="text-sm font-semibold text-foreground">
                Sort
              </Label>
              <Select value={draftSort} onValueChange={setDraftSort}>
                <SelectTrigger className="h-10 rounded-md border-border/60 bg-muted/20 px-3 text-sm shadow-none focus:ring-1 focus:ring-border focus:ring-offset-0">
                  <span>{draftOption?.label ?? "Choose sort order"}</span>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectGroup>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </section>

            <div className="h-px bg-border/60" />

            <DiscoverFilterSections
              type={type}
              genres={genres}
              providers={providers}
              getFilter={getFilter}
              setFilter={setFilter}
            />
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row gap-2 border-t border-border/60 bg-background px-4 py-4 shadow-[0_-12px_28px_rgba(0,0,0,0.22)] sm:space-x-0 md:px-6">
          <Button
            size="lg"
            variant="outline"
            onClick={clearFilters}
            className="flex-1 shadow-none"
          >
            Clear filters
          </Button>
          <SheetClose
            className={cn(buttonVariants({ size: "lg" }), "flex-1")}
            onClick={saveFilterSort}
          >
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
  compactOnMobile?: boolean;
  triggerClassName?: string;
}

export const DiscoverSort: React.FC<DiscoverSortProps> = ({
  type,
  compactOnMobile = false,
  triggerClassName,
}) => {
  const { options, getSort, setSort } = useSort(type);
  const activeSort = getSort();
  const activeOption = getActiveSortOption(options, activeSort);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "outline" }), triggerClassName)}
        aria-label={`Sort by ${activeOption?.label ?? "Most Popular"}`}
      >
        <ArrowDownWideNarrow className="mr-2 size-4" />
        {compactOnMobile ? (
          <>
            <span className="md:hidden">Sort</span>
            <span className="hidden md:inline">
              Sort: {activeOption?.label ?? "Most Popular"}
            </span>
          </>
        ) : (
          <span>Sort: {activeOption?.label ?? "Most Popular"}</span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-1">
        <DiscoverSortOptions
          options={options}
          activeSort={activeOption?.value ?? activeSort}
          onSelect={setSort}
        />
      </PopoverContent>
    </Popover>
  );
};
