"use client";

import { Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { formatMalEpisodeTotal } from "@/lib/mal/constants";
import { cn } from "@/lib/utils";

const MAX_INPUT_DIGITS = 4;
const MAX_INPUT_VALUE = 10 ** MAX_INPUT_DIGITS - 1;

type InlineNumberEditorProps = {
  value: number;
  onCommit: (value: number) => void;
  totalEpisodes?: number | null;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  prefix?: string;
  className?: string;
  displayClassName?: string;
  inputClassName?: string;
  showIncrement?: boolean;
  showDecrement?: boolean;
  incrementDisabled?: boolean;
  decrementDisabled?: boolean;
  ariaLabel?: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const parseDraft = (draft: string): number | null => {
  if (draft.trim() === "") {
    return null;
  }

  const parsed = Number.parseInt(draft, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const valueClass = "text-sm font-medium tabular-nums text-white leading-none";

const valueSlotClass =
  "inline-block w-[4ch] shrink-0 text-right align-baseline";

const minimalInputClass =
  "block w-full border-0 bg-transparent p-0 text-right shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

const isValidDraft = (next: string) =>
  next === "" || (/^\d+$/.test(next) && next.length <= MAX_INPUT_DIGITS);

export function InlineNumberEditor({
  value,
  onCommit,
  totalEpisodes = null,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  disabled = false,
  prefix,
  className,
  displayClassName,
  inputClassName,
  showIncrement = true,
  showDecrement = false,
  incrementDisabled = false,
  decrementDisabled = false,
  ariaLabel = "Edit number",
}: InlineNumberEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const totalLabel = formatMalEpisodeTotal(totalEpisodes);
  const effectiveMax = Math.min(max, MAX_INPUT_VALUE);

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(value));
    }
  }, [isEditing, value]);

  useLayoutEffect(() => {
    if (!isEditing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const commitDraft = useCallback(() => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? min : clamp(parsed, min, effectiveMax);

    setIsEditing(false);
    setDraft(String(next));

    if (next !== value) {
      onCommit(next);
    }
  }, [draft, effectiveMax, min, onCommit, value]);

  const cancelEdit = useCallback(() => {
    setDraft(String(value));
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const current = parseDraft(draft) ?? value;
      setDraft(String(clamp(current + step, min, effectiveMax)));
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const current = parseDraft(draft) ?? value;
      setDraft(String(clamp(current - step, min, effectiveMax)));
    }
  };

  const handleIncrement = () => {
    onCommit(clamp(value + step, min, effectiveMax));
  };

  const handleDecrement = () => {
    onCommit(clamp(value - step, min, effectiveMax));
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {prefix ? (
        <span className={cn("shrink-0 text-white/80", valueClass)}>
          {prefix}
        </span>
      ) : null}

      <span
        className={cn(
          "inline-flex items-baseline whitespace-nowrap",
          valueClass,
        )}
      >
        <span className={valueSlotClass}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={MAX_INPUT_DIGITS}
              value={draft}
              disabled={disabled}
              aria-label={ariaLabel}
              className={cn(minimalInputClass, valueClass, inputClassName)}
              onChange={(event) => {
                const next = event.target.value;
                if (isValidDraft(next)) {
                  setDraft(next);
                }
              }}
              onBlur={commitDraft}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <button
              type="button"
              disabled={disabled}
              aria-label={ariaLabel}
              className={cn(
                "block w-full border-0 bg-transparent p-0 text-right",
                "outline-none ring-0 focus:outline-none focus-visible:outline-none",
                disabled && "cursor-not-allowed opacity-50",
                valueClass,
                displayClassName,
              )}
              onClick={() => {
                if (disabled) {
                  return;
                }
                setDraft(String(value));
                setIsEditing(true);
              }}
            >
              {value}
            </button>
          )}
        </span>
        /{totalLabel}
      </span>

      {showDecrement ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-6 shrink-0 rounded-md bg-white/10 text-white hover:bg-white/20 hover:text-white"
          disabled={disabled || decrementDisabled || value <= min}
          onClick={handleDecrement}
          aria-label="Decrease value"
        >
          <Minus className="size-3.5" />
        </Button>
      ) : null}

      {showIncrement ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-6 shrink-0 rounded-md bg-sky-600/90 text-white hover:bg-sky-500 hover:text-white"
          disabled={disabled || incrementDisabled || value >= effectiveMax}
          onClick={handleIncrement}
          aria-label="Increase value"
        >
          <Plus className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
