const YEAR_SUFFIX = /^\d{4}$/;

export const scrapeCatalogTitle = (
  title: string,
  year?: string | number | null,
): string => {
  const trimmed = title.trim();
  if (!trimmed) {
    return trimmed;
  }

  const yearText = year == null ? "" : String(year).trim();
  if (!YEAR_SUFFIX.test(yearText)) {
    return trimmed;
  }

  const wrapped = `(${yearText})`;
  if (trimmed.endsWith(wrapped)) {
    return trimmed;
  }

  return `${trimmed} ${wrapped}`;
};
