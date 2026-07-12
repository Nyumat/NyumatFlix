import { cva, type VariantProps } from "class-variance-authority";
import {
  CheckIcon,
  ChevronDown,
  WandSparkles,
  XCircle,
  XIcon,
} from "lucide-react";

import { forwardRef, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { cn } from "@/lib/utils";

const multiSelectVariants = cva("m-1 transition ease-in-out", {
  variants: {
    variant: {
      default:
        "border border-primary/30 bg-primary/12 text-primary backdrop-blur-md shadow-xs hover:bg-primary/22 dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20",
      secondary:
        "border border-border/60 bg-secondary/35 text-secondary-foreground backdrop-blur-md hover:bg-secondary/55 dark:border-white/25 dark:bg-white/10 dark:text-white",
      destructive:
        "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
      inverted: "inverted",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface MultiSelectProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof multiSelectVariants> {
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];

  onValueChange: (value: string[]) => void;

  defaultValue: string[];

  placeholder?: string;

  animation?: number;

  maxCount?: number;

  modalPopover?: boolean;

  asChild?: boolean;

  className?: string;
}

export const MultiSelect = forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      options,
      onValueChange,
      variant,
      defaultValue = [],
      placeholder = "Select options",
      animation = 0,
      maxCount = 3,
      modalPopover = false,
      className,
      ...props
    },
    ref,
  ) => {
    const {
      selectedValues,
      isPopoverOpen,
      isAnimating,
      setSelectedValues,
      toggleOption,
      handleClear,
      handleTogglePopover,
      clearExtraOptions,
      toggleAll,
      setIsAnimating,
      setIsPopoverOpen,
    } = useMultiSelect(defaultValue);

    const handleInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
      if (event.key === "Enter") {
        setIsPopoverOpen(true);
      } else if (event.key === "Backspace" && !event.currentTarget.value) {
        const newSelectedValues = [...selectedValues];
        newSelectedValues.pop();
        setSelectedValues(newSelectedValues);
        onValueChange(newSelectedValues);
      }
    };

    useEffect(() => {
      onValueChange(selectedValues);
    }, [selectedValues]);

    return (
      <Popover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        modal={modalPopover}
      >
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            {...props}
            onClick={handleTogglePopover}
            className={cn(
              "flex h-auto min-h-10 w-full min-w-0 items-center rounded-md p-1",
              className,
            )}
          >
            {selectedValues.length > 0 ? (
              <div className="flex w-full min-w-0 items-center gap-1">
                <div
                  className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-0.5"
                  id="scrollbar_hide"
                >
                  {selectedValues.slice(0, maxCount).map((value) => {
                    const option = options.find((o) => o.value === value);
                    const IconComponent = option?.icon;
                    return (
                      <Badge
                        key={value}
                        className={cn(
                          isAnimating ? "animate-bounce" : "",
                          multiSelectVariants({ variant }),
                          "inline-flex max-w-none shrink-0 items-center gap-1 whitespace-nowrap px-2 py-1 font-semibold",
                        )}
                        style={{ animationDuration: `${animation}s` }}
                      >
                        {IconComponent && (
                          <IconComponent className="size-4 shrink-0" />
                        )}
                        <span className="shrink-0">{option?.label}</span>
                        {selectedValues.length > 1 ? (
                          <XCircle
                            className="size-4 shrink-0 cursor-pointer transition-colors hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleOption(value);
                            }}
                          />
                        ) : null}
                      </Badge>
                    );
                  })}
                  {selectedValues.length > maxCount && (
                    <Badge
                      className={cn(
                        "shrink-0 whitespace-nowrap border-foreground/10 bg-transparent text-foreground hover:bg-transparent",
                        isAnimating ? "animate-bounce" : "",
                        multiSelectVariants({ variant }),
                      )}
                      style={{ animationDuration: `${animation}s` }}
                    >
                      {`+ ${selectedValues.length - maxCount} more`}
                      <XCircle
                        className="ml-1.5 size-4 shrink-0 cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          clearExtraOptions(maxCount);
                        }}
                      />
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center">
                  <XIcon
                    className="mx-1.5 size-4 shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClear();
                    }}
                  />
                  <Separator orientation="vertical" className="h-5 shrink-0" />
                  <ChevronDown className="mx-1.5 size-4 shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-primary" />
                </div>
              </div>
            ) : (
              <div className="flex w-full items-center justify-between gap-2 px-2">
                <span className="min-w-0 flex-1 truncate text-left text-sm text-muted-foreground">
                  {placeholder}
                </span>
                <ChevronDown className="size-4 shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-primary" />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 border border-primary/20 shadow-lg"
          align="start"
          onEscapeKeyDown={() => setIsPopoverOpen(false)}
        >
          <Command>
            <CommandInput
              placeholder="Search..."
              onKeyDown={handleInputKeyDown}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  key="all"
                  onSelect={() => toggleAll(options.map((o) => o.value))}
                  className="cursor-pointer"
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-xs border border-primary",
                      selectedValues.length === options.length
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible",
                    )}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </div>
                  <span>(Select All)</span>
                </CommandItem>
                {options.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => toggleOption(option.value)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-xs border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible",
                        )}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </div>
                      {option.icon && (
                        <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <div className="flex items-center justify-between">
                  {selectedValues.length > 0 && (
                    <>
                      <CommandItem
                        onSelect={handleClear}
                        className="flex-1 justify-center cursor-pointer"
                      >
                        Clear
                      </CommandItem>
                      <Separator
                        orientation="vertical"
                        className="flex min-h-6 h-full"
                      />
                    </>
                  )}
                  <CommandItem
                    onSelect={() => setIsPopoverOpen(false)}
                    className="flex-1 justify-center cursor-pointer max-w-full"
                  >
                    Close
                  </CommandItem>
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
        {animation > 0 && selectedValues.length > 0 && (
          <WandSparkles
            className={cn(
              "cursor-pointer my-2 text-foreground bg-background w-3 h-3",
              isAnimating ? "" : "text-muted-foreground",
            )}
            onClick={() => setIsAnimating(!isAnimating)}
          />
        )}
      </Popover>
    );
  },
);

MultiSelect.displayName = "MultiSelect";
