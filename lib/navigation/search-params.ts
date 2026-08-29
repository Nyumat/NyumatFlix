export const stripSearchParam = (
  pathname: string,
  searchParams: Pick<URLSearchParams, "get" | "has" | "toString">,
  key: string,
): string => {
  if (!searchParams.has(key)) {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  const params = new URLSearchParams(searchParams.toString());
  params.delete(key);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};
