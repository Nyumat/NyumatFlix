export function formatYear(dateString?: string | null): string | undefined {
  if (!dateString) return undefined;
  const year = dateString.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : undefined;
}

export function formatYearOrTba(dateString?: string | null): string {
  return formatYear(dateString) ?? "TBA";
}

export function formatRuntime(minutes?: number | null): string | undefined {
  if (!minutes || minutes <= 0) return undefined;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

export function formatRating(value?: number | null): string | undefined {
  if (!value || value <= 0) return undefined;
  return value.toFixed(1);
}
