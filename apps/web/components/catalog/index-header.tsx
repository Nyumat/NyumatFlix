import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

type IndexHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  action?: ReactNode;
  className?: string;
  align?: "left" | "center";
};

export function IndexHeader({
  title,
  description,
  backHref,
  action,
  className,
  align = "left",
}: IndexHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <div
        className={cn(
          "min-w-0 space-y-3",
          align === "center" && "mx-auto max-w-2xl",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            align === "center" && "justify-center",
          )}
        >
          {backHref ? (
            <Link
              href={backHref}
              aria-label={`Back to index`}
              className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-5" />
            </Link>
          ) : null}
          <h1 className="text-4xl font-black tracking-tight text-foreground md:text-6xl">
            {title}
          </h1>
        </div>

        {description ? (
          <p
            className={cn(
              "max-w-xl text-base text-muted-foreground md:text-lg",
              align === "center" && "mx-auto",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
