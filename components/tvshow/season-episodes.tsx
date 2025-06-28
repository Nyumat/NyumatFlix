import Image from "next/legacy/image";
import { Tv } from "lucide-react";
import { Episode } from "@/utils/typings";
import { fetchSeasonDetails } from "./tvshow-api";

type SeasonEpisodesProps = {
  tvId: string;
  seasonNumber: number;
};

export async function SeasonEpisodes({
  tvId,
  seasonNumber,
}: SeasonEpisodesProps) {
  const seasonDetails = await fetchSeasonDetails(tvId, seasonNumber);

  if (
    !seasonDetails ||
    !seasonDetails.episodes ||
    seasonDetails.episodes.length === 0
  ) {
    return (
      <div className="text-gray-400 py-4">
        No episode data available for this season.
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-2">
      <h3 className="text-xl font-semibold text-white">Episodes</h3>
      <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-4">
          {seasonDetails.episodes.map((episode: Episode) => (
            <div
              key={episode.id}
              className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800 transition cursor-pointer"
            >
              <div className="flex">
                <div className="w-32 h-20 rounded overflow-hidden mr-4 flex-shrink-0">
                  {episode.still_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
                      alt={episode.name}
                      width={300}
                      height={169}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <Tv size={20} className="text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h4 className="text-white font-medium">
                      {episode.episode_number}. {episode.name}
                    </h4>
                    <div className="text-gray-400 text-sm">
                      {episode.runtime ? `${episode.runtime} min` : ""}
                    </div>
                  </div>
                  {episode.air_date && (
                    <div className="text-gray-400 text-xs mb-1">
                      {new Date(episode.air_date).toLocaleDateString()}
                    </div>
                  )}
                  <p className="text-gray-300 text-sm line-clamp-2">
                    {episode.overview}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
