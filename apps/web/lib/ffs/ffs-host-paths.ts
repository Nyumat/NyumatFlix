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
