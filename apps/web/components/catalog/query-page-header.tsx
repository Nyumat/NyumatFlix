import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

type QueryPageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  className?: string;
};

export const QueryPageHeader = ({
  title,
  description,
  backHref,
  className,
}: QueryPageHeaderProps) => (
  <header className={cn("space-y-1 text-left", className)}>
    <div className="flex items-center gap-3">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Back to index"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md transition hover:border-white/30 hover:bg-black/60 focus:outline-hidden focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent md:size-9"
        >
          <ChevronLeft className="size-5" strokeWidth={2.5} />
        </Link>
      ) : null}
      <h1 className="min-w-0 text-2xl font-bold tracking-tight sm:text-4xl md:text-5xl">
        {title}
      </h1>
    </div>
    {description ? (
      <p className="text-muted-foreground">{description}</p>
    ) : null}
  </header>
);
