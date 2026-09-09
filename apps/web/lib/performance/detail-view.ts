export type DetailApiView = "shell" | "full";

export const parseDetailApiView = (
  searchParams: URLSearchParams,
): DetailApiView => {
  const view = searchParams.get("view");
  if (view === "full") {
    return "full";
  }
  return "shell";
};
