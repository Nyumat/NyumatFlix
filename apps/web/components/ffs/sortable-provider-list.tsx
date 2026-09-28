"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useCallback, useState } from "react";

export type SortableProviderItem = {
  id: string;
  label: string;
  enabled: boolean;
  hint?: string;
};

type SortableProviderListProps = {
  items: SortableProviderItem[];
  onReorder: (nextIds: string[]) => void;
  sectionLabel?: string;
  sectionHint?: string;
};

const moveItem = (ids: string[], from: number, to: number): string[] => {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= ids.length ||
    to >= ids.length
  ) {
    return ids;
  }

  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (!item) {
    return ids;
  }
  next.splice(to, 0, item);
  return next;
};

export function SortableProviderList({
  items,
  onReorder,
  sectionLabel,
  sectionHint,
}: SortableProviderListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const ids = items.map((item) => item.id);

  const handleMove = useCallback(
    (from: number, to: number) => {
      onReorder(moveItem(ids, from, to));
    },
    [ids, onReorder],
  );

  return (
    <div className="space-y-2">
      {sectionLabel ? (
        <div>
          <p className="text-xs font-medium text-foreground">{sectionLabel}</p>
          {sectionHint ? (
            <p className="text-[11px] text-muted-foreground">{sectionHint}</p>
          ) : null}
        </div>
      ) : null}
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDraggingId(item.id)}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTargetId(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTargetId(item.id);
            }}
            onDragLeave={() => {
              setDropTargetId((current) =>
                current === item.id ? null : current,
              );
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggingId || draggingId === item.id) {
                return;
              }
              const from = ids.indexOf(draggingId);
              const to = ids.indexOf(item.id);
              handleMove(from, to);
              setDraggingId(null);
              setDropTargetId(null);
            }}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40",
              !item.enabled && "opacity-50",
              draggingId === item.id && "bg-muted/60 shadow-sm",
              dropTargetId === item.id &&
                draggingId !== item.id &&
                "bg-muted/30",
            )}
          >
            <GripVertical
              className="size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{item.label}</p>
              {item.hint ? (
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {item.hint}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                aria-label={`Move ${item.label} up`}
                disabled={index === 0}
                onClick={() => handleMove(index, index - 1)}
                className="rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground disabled:opacity-30 motion-reduce:transition-none"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Move ${item.label} down`}
                disabled={index === items.length - 1}
                onClick={() => handleMove(index, index + 1)}
                className="rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground disabled:opacity-30 motion-reduce:transition-none"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
