import { determineMediaType } from "@/app/actions";
import { HeroSection } from "@/app/home/render-row";

async function fetchDetails(id: string, mediaType: "movie" | "tv" | "unknown") {
  if (mediaType === "unknown") {
    return null;
  }
  let data;
  try {
    data = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US&append_to_response=videos,images,credits,recommendations`,
    );
    data = await data.json();
  } catch (error) {
    console.error(error);
    throw new Error("Failed to fetch movie details");
  }
  return data;
}

export default async function Watch({ params }: { params: { id: string } }) {
  const { id } = params;
  const mediaType = await determineMediaType(id);
  const details = await fetchDetails(id, mediaType);

  console.log(details);
  return (
    <>
      <HeroSection media={[details]} noSlide isWatch />
    </>
  );
}
