import { cn } from "@/lib/utils";
import { Children, type ReactNode } from "react";

type MediaPeekMetaRowProps = {
  children: ReactNode;
  className?: string;
};

export const MediaPeekMetaRow = ({
  children,
  className,
}: MediaPeekMetaRowProps) => {
  const items = Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;

  const row = items.reduce<ReactNode[]>((acc, item, index) => {
    if (index === 0) return [item];
    return [
      ...acc,
      <span
        key={`dot-${index}`}
        className="text-muted-foreground/70"
        aria-hidden
      >
        ·
      </span>,
      item,
    ];
  }, []);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground",
        className,
      )}
    >
      {row}
    </div>
  );
};
