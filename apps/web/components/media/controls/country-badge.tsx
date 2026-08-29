"use client";
import { countries } from "country-data-list";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getFriendlyCountryName } from "@/utils/country-helpers";

const sizeClasses = {
  sm: "text-xs px-2 py-1 gap-1",
  md: "text-sm px-2.5 py-1.5 gap-1.5",
  lg: "text-base px-3 py-2 gap-2",
};

export type ProductionCountry = {
  iso_3166_1: string;
  name: string;
};

type CountryBadgeProps = {
  country: ProductionCountry;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  showFlag?: boolean;
  showName?: boolean;
  size?: "sm" | "md" | "lg";
  clickable?: boolean;
  mediaType?: "movie" | "tv";
};

type CountryBadgeListProps = {
  countries: ProductionCountry[];
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  showFlag?: boolean;
  showName?: boolean;
  size?: "sm" | "md" | "lg";
  maxDisplay?: number;
  clickable?: boolean;
  mediaType?: "movie" | "tv";
};

const CountryBadge = ({
  country,
  variant = "outline",
  className,
  showFlag = true,
  showName = true,
  size = "md",
  clickable = true,
  mediaType = "movie",
}: CountryBadgeProps) => {
  const countryData = countries.all.find(
    (c) => c.alpha2 === country.iso_3166_1,
  );

  const displayName = getFriendlyCountryName(country.iso_3166_1, country.name);

  const emojiSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const href = `/browse/country/${country.iso_3166_1.toLowerCase()}?type=${mediaType}`;
  const tooltipText = `Browse ${displayName} ${
    mediaType === "movie" ? "movies" : "TV shows"
  }`;

  const badgeContent = (href?: string) => (
    <Badge
      variant={variant}
      href={href}
      className={cn(
        "inline-flex items-center font-medium",
        sizeClasses[size],
        clickable &&
          "cursor-pointer transition-all hover:scale-105 hover:shadow-md",
        className,
      )}
    >
      {showFlag && countryData?.emoji && (
        <span className={cn("leading-none", emojiSizeClasses[size])}>
          {countryData.emoji}
        </span>
      )}
      {showName && <span className="truncate">{displayName}</span>}
    </Badge>
  );

  if (!clickable) {
    return badgeContent();
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badgeContent(href)}</TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const CountryBadgeList = ({
  countries,
  variant = "outline",
  className,
  showFlag = true,
  showName = true,
  size = "md",
  maxDisplay,
  clickable = true,
  mediaType = "movie",
}: CountryBadgeListProps) => {
  const displayCountries = maxDisplay
    ? countries.slice(0, maxDisplay)
    : countries;
  const remainingCount =
    maxDisplay && countries.length > maxDisplay
      ? countries.length - maxDisplay
      : 0;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {displayCountries.map((country) => (
        <CountryBadge
          key={country.iso_3166_1}
          country={country}
          variant={variant}
          showFlag={showFlag}
          showName={showName}
          size={size}
          clickable={clickable}
          mediaType={mediaType}
        />
      ))}
      {remainingCount > 0 && (
        <Badge
          variant={variant}
          className={cn("font-medium", sizeClasses[size])}
        >
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
};

export { CountryBadge, CountryBadgeList };
