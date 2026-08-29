import {
  getPlaybackProgress,
  resolveResumeTime,
} from "@/lib/playback/progress-storage";

export const movieWatchButtonLabel = (contentId: number): "Play" | "Resume" => {
  const resumeTime = resolveResumeTime(
    getPlaybackProgress({ mediaType: "movie", contentId }),
  );
  return resumeTime > 0 ? "Resume" : "Play";
};
