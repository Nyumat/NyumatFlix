import { determineMediaType } from "@/app/actions";
import { redirect } from "next/navigation";

export default async function Watch({ params }: { params: { id: string } }) {
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
