import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IntroDbSegmentControl } from "@/components/media/controls/introdb-segment-control";
import type { IntroDbSegment } from "@/lib/playback/introdb";

const intro: IntroDbSegment = {
  id: "intro:30:90:0",
  type: "intro",
  startSeconds: 30,
  endSeconds: 90,
  endsAtMediaEnd: false,
};

const finalCredits: IntroDbSegment = {
  id: "credits:580:end:0",
  type: "credits",
  startSeconds: 580,
  endSeconds: 600,
  endsAtMediaEnd: true,
};

describe("IntroDbSegmentControl", () => {
  it("seeks to the active segment end", async () => {
    const onSeek = vi.fn();
    const user = userEvent.setup();

    render(
      <IntroDbSegmentControl
        segments={[intro]}
        currentTime={45}
        duration={600}
        isTv={false}
        onSeek={onSeek}
      />,
    );

    await user.click(screen.getByRole("button", { name: /skip intro/i }));
    expect(onSeek).toHaveBeenCalledWith(90);
  });

  it("does not render outside a segment", () => {
    render(
      <IntroDbSegmentControl
        segments={[intro]}
        currentTime={100}
        duration={600}
        isTv={false}
        onSeek={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("advances at final TV credits and falls back to the end when unavailable", async () => {
    const onSeek = vi.fn();
    const onAdvanceToNextEpisode = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();

    render(
      <IntroDbSegmentControl
        segments={[finalCredits]}
        currentTime={590}
        duration={600}
        isTv
        onSeek={onSeek}
        onAdvanceToNextEpisode={onAdvanceToNextEpisode}
      />,
    );

    await user.click(screen.getByRole("button", { name: /next episode/i }));

    await waitFor(() => {
      expect(onAdvanceToNextEpisode).toHaveBeenCalledOnce();
      expect(onSeek).toHaveBeenCalledWith(600);
    });
  });
});
