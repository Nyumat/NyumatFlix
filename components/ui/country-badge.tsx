"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { countries } from "country-data-list";

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
};

type CountryBadgeListProps = {
  countries: ProductionCountry[];
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  showFlag?: boolean;
  showName?: boolean;
  size?: "sm" | "md" | "lg";
  maxDisplay?: number;
};

const CountryBadge = ({
  country,
  variant = "outline",
  className,
  showFlag = true,
  showName = true,
  size = "md",
}: CountryBadgeProps) => {
  const countryData = countries.all.find(
    (c) => c.alpha2 === country.iso_3166_1,
  );

  const emojiSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <Badge
      variant={variant}
      className={cn(
        "inline-flex items-center font-medium",
        sizeClasses[size],
        className,
      )}
    >
      {showFlag && countryData?.emoji && (
        <span className={cn("leading-none", emojiSizeClasses[size])}>
          {countryData.emoji}
        </span>
      )}
      {showName && <span className="truncate">{country.name}</span>}
    </Badge>
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
