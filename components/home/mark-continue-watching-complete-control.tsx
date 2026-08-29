"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useState } from "react";

export type MarkContinueWatchingCompleteControlProps = {
  title: string;
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
  className?: string;
};

export function MarkContinueWatchingCompleteControl({
  title,
  isPending = false,
  onConfirm,
  className,
}: MarkContinueWatchingCompleteControlProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "relative z-50 pointer-events-auto opacity-100 transition-opacity duration-300",
        !open &&
          "md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:focus-within:pointer-events-auto md:focus-within:opacity-100",
        className,
      )}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Mark ${title} as complete`}
            className="flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Check className="size-4" strokeWidth={2.5} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-2.5">
          <p className="mb-2 text-xs font-medium">Mark as complete?</p>
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => {
                void handleConfirm();
              }}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              No
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
