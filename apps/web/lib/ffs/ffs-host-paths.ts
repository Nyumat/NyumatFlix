const FFS_HOST_ALLOWED_PREFIXES = [
  "/ffs",
  "/api/ffs",
  "/api/auth",
  "/api/cap",
  "/api/site",
] as const;

export const isFfsHostAllowedPath = (pathname: string): boolean =>
  FFS_HOST_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export const isFfsAdminPath = (pathname: string): boolean =>
  pathname === "/ffs" || pathname.startsWith("/ffs/");

export const isFfsHost = (host: string | null): boolean => {
  if (!host) return false;
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return hostname.startsWith("ffs.");
};

export const shouldSkipRouteScrollManagement = (
  pathname: string,
  host: string | null = null,
): boolean => {
  if (isFfsAdminPath(pathname)) return true;
  if (isFfsHost(host)) return true;
  return false;
};
