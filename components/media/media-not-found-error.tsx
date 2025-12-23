import Link from "next/link";

type MediaNotFoundErrorProps = {
  mediaType: "movie" | "tv";
  title: string;
  message?: string;
};

export function MediaNotFoundError({
  mediaType,
  title,
  message,
}: MediaNotFoundErrorProps) {
  const backLink = mediaType === "movie" ? "/movies" : "/tvshows";
  const backText =
    mediaType === "movie" ? "Back to Movies" : "Back to TV Shows";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-2xl font-bold text-foreground mb-4">{title}</h1>
      <p className="text-muted-foreground mb-4">
        {message ||
          `The requested ${mediaType === "movie" ? "movie" : "TV show"} could not be found.`}
      </p>
      <Link href={backLink} className="mt-4 text-primary hover:underline">
        {backText}
      </Link>
    </div>
  );
}
