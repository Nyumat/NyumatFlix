import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/app/watchlist/actions", () => ({
  getWatchlistItem: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { WatchlistButton } = await import(
  "@/components/watchlist/watchlist-button"
);
const watchlistActions = await import("@/app/watchlist/actions");

const mockUseSession = vi.mocked(useSession);
const mockGetWatchlistItem = vi.mocked(watchlistActions.getWatchlistItem);

type ToastMock = {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};
const mockToast = toast as unknown as ToastMock;

describe("WatchlistButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("shows loading state initially", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    } as never);

    mockGetWatchlistItem.mockResolvedValue(null);

    render(
      <WatchlistButton contentId={123} mediaType="movie">
        Add to Watchlist
      </WatchlistButton>,
    );

    expect(screen.getByTestId("watchlist-button-loading")).toBeInTheDocument();
    expect(
      screen.getByTestId("watchlist-button-loading-text"),
    ).toHaveTextContent("Loading...");
  });

  test("shows bookmark icon when item is not in watchlist", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    } as never);

    mockGetWatchlistItem.mockResolvedValue(null);

    render(
      <WatchlistButton contentId={123} mediaType="movie">
        Add to Watchlist
      </WatchlistButton>,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("watchlist-button-loading"),
      ).not.toBeInTheDocument();
    });

    const button = screen.getByTestId("watchlist-button-add");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-in-watchlist", "false");
    expect(button).toHaveAttribute("data-content-id", "123");
    expect(button).toHaveAttribute("data-media-type", "movie");
  });

  test("shows bookmark check icon when item is in watchlist", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    } as never);

    mockGetWatchlistItem.mockResolvedValue({
      id: "item-1",
      userId: "user-123",
      contentId: 123,
      mediaType: "movie",
      status: "watching",
    } as never);

    render(
      <WatchlistButton contentId={123} mediaType="movie">
        Remove from Watchlist
      </WatchlistButton>,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("watchlist-button-loading"),
      ).not.toBeInTheDocument();
    });

    const button = screen.getByTestId("watchlist-button-remove");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-in-watchlist", "true");
  });

  test("shows error toast when user is not logged in", async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    } as never);

    mockGetWatchlistItem.mockResolvedValue(null);

    const user = userEvent.setup();
    render(
      <WatchlistButton contentId={123} mediaType="movie">
        Add to Watchlist
      </WatchlistButton>,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("watchlist-button-loading"),
      ).not.toBeInTheDocument();
    });

    const button = screen.getByTestId("watchlist-button-add");
    await user.click(button);

    expect(mockToast.error).toHaveBeenCalledWith(
      "To add items to your watchlist, you must be logged in.",
    );
  });

  test("adds item to watchlist when clicked", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    } as never);

    mockGetWatchlistItem.mockResolvedValue(null);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ item: { id: "new-item" } }),
    } as Response);

    const user = userEvent.setup();
    render(
      <WatchlistButton contentId={123} mediaType="movie">
        Add to Watchlist
      </WatchlistButton>,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("watchlist-button-loading"),
      ).not.toBeInTheDocument();
    });

    const button = screen.getByTestId("watchlist-button-add");
    await user.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentId: 123,
          mediaType: "movie",
          status: "watching",
        }),
      });
    });

    expect(mockToast.success).toHaveBeenCalledWith("Added to watchlist");
  });

  test("removes item from watchlist when clicked", async () => {
    const mockItem = {
      id: "item-1",
      userId: "user-123",
      contentId: 123,
      mediaType: "movie",
      status: "watching",
    };

    mockUseSession.mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    } as never);

    mockGetWatchlistItem
      .mockResolvedValueOnce(mockItem as never)
      .mockResolvedValueOnce(mockItem as never);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Item removed" }),
    } as Response);

    const user = userEvent.setup();
    render(
      <WatchlistButton contentId={123} mediaType="movie">
        Remove from Watchlist
      </WatchlistButton>,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("watchlist-button-loading"),
      ).not.toBeInTheDocument();
    });

    const button = screen.getByTestId("watchlist-button-remove");
    await user.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/watchlist/item-1", {
        method: "DELETE",
      });
    });

    expect(mockToast.success).toHaveBeenCalledWith("Removed from watchlist");
  });

  test("handles API errors gracefully", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    } as never);

    mockGetWatchlistItem.mockResolvedValue(null);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const user = userEvent.setup();
    render(
      <WatchlistButton contentId={123} mediaType="movie">
        Add to Watchlist
      </WatchlistButton>,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("watchlist-button-loading"),
      ).not.toBeInTheDocument();
    });

    const button = screen.getByTestId("watchlist-button-add");
    await user.click(button);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Failed to add to watchlist",
      );
    });
  });

  test("does not fetch when mediaType is missing", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    } as never);

    render(<WatchlistButton contentId={123} />);

    await waitFor(() => {
      expect(mockGetWatchlistItem).not.toHaveBeenCalled();
    });
  });

  test("prevents multiple clicks while loading", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    } as never);

    mockGetWatchlistItem.mockResolvedValue(null);

    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      fetchPromise as Promise<Response>,
    );

    const user = userEvent.setup();
    render(
      <WatchlistButton contentId={123} mediaType="movie">
        Add to Watchlist
      </WatchlistButton>,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("watchlist-button-loading"),
      ).not.toBeInTheDocument();
    });

    const button = screen.getByTestId("watchlist-button-add");

    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    await user.click(button);
    await user.click(button);

    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch!({
      ok: true,
      json: async () => ({ item: { id: "new-item" } }),
    });

    await waitFor(() => {
      const updatedButton = screen.getByTestId("watchlist-button-remove");
      expect(updatedButton).not.toBeDisabled();
    });
  });
});
