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
  <header className={cn("space-y-1 text-center md:text-left", className)}>
    <div className="flex items-center justify-center gap-3 md:justify-start">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Back to index"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-lg backdrop-blur-md transition hover:border-white/30 hover:bg-white/20 focus:outline-hidden focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent"
        >
          <ChevronLeft className="size-5" strokeWidth={2.5} />
        </Link>
      ) : null}
      <h1 className="min-w-0 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
        {title}
      </h1>
    </div>
    {description ? (
      <p className="text-muted-foreground">{description}</p>
    ) : null}
  </header>
);
