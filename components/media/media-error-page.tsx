import Link from "next/link";

type MediaErrorPageProps = {
  mediaType: "movie" | "tv";
  title: string;
  message?: string;
};

export function MediaErrorPage({
  mediaType,
  title,
  message,
}: MediaErrorPageProps) {
  const backLink = mediaType === "movie" ? "/movies" : "/tvshows";
  const backText =
    mediaType === "movie" ? "Back to Movies" : "Back to TV Shows";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-2xl font-bold text-foreground mb-4">{title}</h1>
      <p className="text-muted-foreground mb-4">
        {message ||
          `There was an error loading this ${mediaType === "movie" ? "movie" : "TV show"}.`}
      </p>
      <Link href={backLink} className="mt-4 text-primary hover:underline">
        {backText}
      </Link>
    </div>
  );
}
