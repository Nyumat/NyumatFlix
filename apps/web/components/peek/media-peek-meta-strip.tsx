import { buildProductionCompanyCatalogUrl } from "@/lib/catalog-query";
import { cn } from "@/lib/utils";
import { Folder } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { tmdbImage } from "@/tmdb/utils";

export type PeekFact = {
  label: string;
  value: string;
  href?: string;
};

type MediaPeekMetaStripProps = {
  facts: PeekFact[];
  mediaType: "movie" | "tv";
  collection?: {
    id: number;
    name: string;
  } | null;
  companies: Array<{
    id: number;
    name: string;
    logo_path: string | null;
  }>;
  onNavigate?: () => void;
  className?: string;
};

export const MediaPeekMetaStrip = ({
  facts,
  mediaType,
  collection,
  companies,
  onNavigate,
  className,
}: MediaPeekMetaStripProps) => {
  const visibleCompanies = companies.filter(
    (company): company is typeof company & { logo_path: string } =>
      company.logo_path != null,
  );
  const hasCollection = Boolean(collection);
  if (facts.length === 0 && !hasCollection && visibleCompanies.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/6 px-4 py-3 md:px-8",
        className,
      )}
    >
      {facts.map((fact, index) => (
        <span
          key={fact.label}
          className="inline-flex items-center gap-1.5 text-xs sm:text-[13px]"
        >
          {index > 0 ? (
            <span className="mr-1 text-muted-foreground/40" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="text-muted-foreground">{fact.label}</span>
          {fact.href ? (
            <Link
              href={fact.href}
              onClick={onNavigate}
              className="font-medium text-foreground/90 underline-offset-2 transition hover:text-primary hover:underline"
            >
              {fact.value}
            </Link>
          ) : (
            <span className="font-medium text-foreground/90">{fact.value}</span>
          )}
        </span>
      ))}

      {hasCollection ? (
        <Link
          href={`/collection/${collection?.id}`}
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-primary/30 hover:bg-white/10"
        >
          <Folder className="size-3.5 text-primary" aria-hidden />
          {collection?.name}
        </Link>
      ) : null}

      {visibleCompanies.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {visibleCompanies.slice(0, 4).map((company) => (
            <Link
              key={company.id}
              href={buildProductionCompanyCatalogUrl(mediaType, company)}
              onClick={onNavigate}
              aria-label={`Browse titles from ${company.name}`}
              className="inline-flex h-8 items-center justify-center rounded-md border-0 bg-white/88 px-2.5 shadow-md backdrop-blur-sm transition hover:bg-white hover:shadow-lg"
            >
              <Image
                src={tmdbImage.logo(company.logo_path, "w154")}
                alt=""
                width={64}
                height={20}
                className="h-4 w-auto max-w-[64px] object-contain"
              />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
};
