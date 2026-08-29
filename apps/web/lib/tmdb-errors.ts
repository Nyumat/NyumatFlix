const readStatus = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }

  if ("response" in error) {
    const response = (error as { response?: { status?: number } }).response;
    if (typeof response?.status === "number") {
      return response.status;
    }
  }

  return null;
};

export const isTmdbNotFoundError = (error: unknown): boolean =>
  readStatus(error) === 404;
