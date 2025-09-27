import { redirect } from "next/navigation";
import { determineMediaType } from "@/app/actions";

export default async function Watch(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const { id } = params;
  const mediaType = await determineMediaType(id);

  // Redirect to the appropriate content page
  if (mediaType === "movie") {
    redirect(`/movies/${id}`);
  } else if (mediaType === "tv") {
    redirect(`/tvshows/${id}`);
  } else {
    // If we can't determine the media type, redirect to homepage
    redirect("/");
  }
}
