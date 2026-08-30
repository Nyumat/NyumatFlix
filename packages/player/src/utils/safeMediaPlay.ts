const isPlayAbortError = (error: unknown): boolean =>
  (error instanceof DOMException || error instanceof Error) &&
  error.name === "AbortError";

export const safeVideoPlay = async (
  video: HTMLVideoElement,
): Promise<void> => {
  try {
    await video.play();
  } catch (error) {
    if (isPlayAbortError(error)) {
      return;
    }
    throw error;
  }
};

export class VideoPlayGate {
  private inFlight: Promise<void> | null = null;

  async play(video: HTMLVideoElement): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const request = safeVideoPlay(video).finally(() => {
      if (this.inFlight === request) {
        this.inFlight = null;
      }
    });
    this.inFlight = request;
    return request;
  }

  reset(): void {
    this.inFlight = null;
  }
}
