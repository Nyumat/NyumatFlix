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
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
            {sectionLabel}
          </p>
          {sectionHint ? (
            <p className="text-[11px] text-white/45">{sectionHint}</p>
          ) : null}
        </div>
      ) : null}
      <ul className="space-y-1">
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
              "flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-2 transition-colors",
              !item.enabled && "opacity-50",
              draggingId === item.id && "opacity-40",
              dropTargetId === item.id &&
                draggingId !== item.id &&
                "border-primary/50 bg-primary/10",
            )}
          >
            <GripVertical
              className="size-4 shrink-0 cursor-grab text-white/35 active:cursor-grabbing"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {item.label}
              </p>
              {item.hint ? (
                <p className="truncate text-[11px] text-white/45">
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
                className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Move ${item.label} down`}
                disabled={index === items.length - 1}
                onClick={() => handleMove(index, index + 1)}
                className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30"
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
