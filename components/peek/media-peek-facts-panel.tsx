import { cn } from "@/lib/utils";
import { Clock3, Folder, Globe2, CalendarDays, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { tmdbImage } from "@/tmdb/utils";

type PeekFact = {
  label: string;
  value: string;
};

type MediaPeekFactsPanelProps = {
  facts: PeekFact[];
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
  style?: CSSProperties;
};

const factIcon = (label: string) => {
  switch (label.toLowerCase()) {
    case "runtime":
    case "ends at":
      return Clock3;
    case "language":
      return Globe2;
    case "release":
      return CalendarDays;
    case "director":
    case "creator":
      return UserRound;
    default:
      return null;
  }
};

const PeekFactRow = ({ label, value }: PeekFact) => {
  const Icon = factIcon(label);

  return (
    <div className="flex items-start gap-3 py-2.5">
      {Icon ? (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/5 text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
        </span>
      ) : (
        <span className="size-7 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
};

export const MediaPeekFactsPanel = ({
  facts,
  collection,
  companies,
  onNavigate,
  className,
  style,
}: MediaPeekFactsPanelProps) => {
  const hasCollection = Boolean(collection);
  const visibleCompanies = companies.filter(
    (company): company is typeof company & { logo_path: string } =>
      company.logo_path != null,
  );
  const hasCompanies = visibleCompanies.length > 0;
  if (facts.length === 0 && !hasCollection && !hasCompanies) return null;

  let footer: ReactNode = null;
  if (hasCollection) {
    footer = (
      <Link
        href={`/collection/${collection?.id}`}
        onClick={onNavigate}
        className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/30 hover:bg-white/10"
      >
        <Folder className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{collection?.name}</span>
      </Link>
    );
  } else if (hasCompanies) {
    footer = (
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/8 pt-3">
        {visibleCompanies.slice(0, 4).map((company) => (
          <Image
            key={company.id}
            src={tmdbImage.logo(company.logo_path, "w154")}
            alt={company.name}
            width={72}
            height={28}
            className="h-5 w-auto max-w-[72px] object-contain opacity-80"
          />
        ))}
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/10 via-card/50 to-card/30 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_24px_48px_-28px_rgba(0,0,0,0.9)] ring-1 ring-white/6 backdrop-blur-2xl sm:p-5",
        className,
      )}
      style={style}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/25 to-transparent"
        aria-hidden
      />
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        At a glance
      </p>
      <div className="divide-y divide-white/8">
        {facts.map((fact) => (
          <PeekFactRow key={fact.label} {...fact} />
        ))}
      </div>
      {footer}
    </aside>
  );
};
