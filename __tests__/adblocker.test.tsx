import { AdblockerAlert } from "@/components/content/adblocker-alert";
import { HeroSection } from "@/components/layout/sections/hero";
import StreamingServices from "@/components/layout/sections/steaming-services";
import { GlobalDockProvider } from "@/components/ui/global-dock";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDetectAdBlock } from "adblock-detect-react";
import { useRouter } from "next/navigation";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

vi.mock("adblock-detect-react", () => ({
  useDetectAdBlock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn().mockResolvedValue(undefined),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  notFound: vi.fn(),
}));

const mockUseDetectAdBlock = useDetectAdBlock as ReturnType<typeof vi.fn>;
const mockUseRouter = useRouter as ReturnType<typeof vi.fn>;

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {
      return vi.fn();
    }
    unobserve() {
      return vi.fn();
    }
    disconnect() {
      return vi.fn();
    }
  };

  global.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  if (typeof Element !== "undefined" && Element.prototype) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <GlobalDockProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </GlobalDockProvider>
  );
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(component, { wrapper: AllTheProviders });
};

describe("AdblockerAlert", () => {
  let mockPush: ReturnType<typeof vi.fn>;
  let mockRouter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush = vi.fn();
    mockRouter = vi.fn(() => ({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn().mockResolvedValue(undefined),
    }));
    mockUseRouter.mockImplementation(mockRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("does not render dialog when openSignal is false", () => {
    renderWithProviders(<AdblockerAlert openSignal={false} />);

    expect(
      screen.queryByRole("dialog", { name: /adblock recommendation dialog/i }),
    ).not.toBeInTheDocument();
  });

  test("opens dialog when openSignal becomes true", async () => {
    const { rerender } = renderWithProviders(
      <AdblockerAlert openSignal={false} />,
    );

    expect(
      screen.queryByTestId("adblocker-alert-dialog"),
    ).not.toBeInTheDocument();

    rerender(<AdblockerAlert openSignal={true} />);

    const dialog = await screen.findByTestId("adblocker-alert-dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("role", "dialog");
  });

  test("displays correct title and description", async () => {
    renderWithProviders(<AdblockerAlert openSignal={true} />);

    await waitFor(() => {
      expect(
        screen.getByText("Are you sure you don't want an ad-blocker?"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/itself is ad-free/i)).toBeInTheDocument();
  });

  test("shows initial CTA buttons", async () => {
    renderWithProviders(<AdblockerAlert openSignal={true} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /show ad blocker options/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /proceed without ad blocker/i }),
    ).toBeInTheDocument();
  });

  test("shows adblocker options when 'Show me adblockers' is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdblockerAlert openSignal={true} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /show ad blocker options/i }),
      ).toBeInTheDocument();
    });

    const showOptionsButton = screen.getByRole("button", {
      name: /show ad blocker options/i,
    });
    await user.click(showOptionsButton);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /show ad blocker options/i }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /continue to home/i }),
    ).toBeInTheDocument();
  });

  test("navigates to home when 'No thanks' is clicked from initial state", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdblockerAlert openSignal={true} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /proceed without ad blocker/i }),
      ).toBeInTheDocument();
    });

    const noThanksButton = screen.getByRole("button", {
      name: /proceed without ad blocker/i,
    });
    await user.click(noThanksButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/home");
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", {
          name: /adblock recommendation dialog/i,
        }),
      ).not.toBeInTheDocument();
    });
  });

  test("navigates to home when 'No thanks' is clicked from options view", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdblockerAlert openSignal={true} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /show ad blocker options/i }),
      ).toBeInTheDocument();
    });

    const showOptionsButton = screen.getByRole("button", {
      name: /show ad blocker options/i,
    });
    await user.click(showOptionsButton);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /show ad blocker options/i }),
      ).not.toBeInTheDocument();
    });

    const noThanksButton = screen.getByRole("button", {
      name: /continue to home/i,
    });
    await user.click(noThanksButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/home");
    });
  });

  test("resets showOptions state when openSignal changes from false to true", async () => {
    const { rerender } = renderWithProviders(
      <AdblockerAlert openSignal={false} />,
    );

    expect(
      screen.queryByTestId("adblocker-alert-dialog"),
    ).not.toBeInTheDocument();

    rerender(<AdblockerAlert openSignal={true} />);

    const dialog = await screen.findByTestId("adblocker-alert-dialog");
    expect(dialog).toBeInTheDocument();

    const user = userEvent.setup();
    const showOptionsButton = await screen.findByRole("button", {
      name: /show ad blocker options/i,
    });
    await user.click(showOptionsButton);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /show ad blocker options/i }),
      ).not.toBeInTheDocument();
    });

    rerender(<AdblockerAlert openSignal={false} />);
    rerender(<AdblockerAlert openSignal={true} />);

    const resetButton = await screen.findByRole("button", {
      name: /show ad blocker options/i,
    });
    expect(resetButton).toBeInTheDocument();
  });

  test("calls onProceed callback when provided instead of navigating to home", async () => {
    const onProceed = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <AdblockerAlert openSignal={true} onProceed={onProceed} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /proceed without ad blocker/i }),
      ).toBeInTheDocument();
    });

    const noThanksButton = screen.getByRole("button", {
      name: /proceed without ad blocker/i,
    });
    await user.click(noThanksButton);

    await waitFor(() => {
      expect(onProceed).toHaveBeenCalled();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("HeroSection", () => {
  let mockPush: ReturnType<typeof vi.fn>;
  let mockPrefetch: ReturnType<typeof vi.fn>;
  let mockRouter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush = vi.fn();
    mockPrefetch = vi.fn().mockResolvedValue(undefined);
    mockRouter = vi.fn(() => ({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: mockPrefetch,
    }));
    mockUseRouter.mockImplementation(mockRouter);
    mockUseDetectAdBlock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("navigates directly to home when adblock is detected", async () => {
    mockUseDetectAdBlock.mockReturnValue(true);

    const user = userEvent.setup();
    renderWithProviders(<HeroSection />);

    const startWatchingButton = await screen.findByTestId(
      "hero-start-watching-button",
    );
    await user.click(startWatchingButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/home");
    });

    expect(mockPrefetch).toHaveBeenCalledWith("/home");
    expect(mockPrefetch).toHaveBeenCalledWith("/movies");
    expect(mockPrefetch).toHaveBeenCalledWith("/tvshows");
  });

  test("triggers alert when adblock is not detected", async () => {
    mockUseDetectAdBlock.mockReturnValue(false);

    const user = userEvent.setup();
    renderWithProviders(<HeroSection />);

    const startWatchingButton = await screen.findByTestId(
      "hero-start-watching-button",
    );
    await user.click(startWatchingButton);

    const dialog = await screen.findByTestId("hero-adblocker-alert");
    expect(dialog).toBeInTheDocument();

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPrefetch).toHaveBeenCalledWith("/home");
    expect(mockPrefetch).toHaveBeenCalledWith("/movies");
    expect(mockPrefetch).toHaveBeenCalledWith("/tvshows");
  });

  test("prefetches routes on button hover", async () => {
    mockUseDetectAdBlock.mockReturnValue(false);

    const user = userEvent.setup();
    renderWithProviders(<HeroSection />);

    const startWatchingButton = await screen.findByTestId(
      "hero-start-watching-button",
    );
    await user.hover(startWatchingButton);

    await waitFor(() => {
      expect(mockPrefetch).toHaveBeenCalledWith("/home");
    });
  });

  test("does not show alert initially", () => {
    mockUseDetectAdBlock.mockReturnValue(false);
    renderWithProviders(<HeroSection />);

    expect(
      screen.queryByTestId("adblocker-alert-dialog"),
    ).not.toBeInTheDocument();
  });

  test("shows alert only after clicking start watching without adblock", async () => {
    mockUseDetectAdBlock.mockReturnValue(false);

    const user = userEvent.setup();
    renderWithProviders(<HeroSection />);

    expect(
      screen.queryByTestId("hero-adblocker-alert"),
    ).not.toBeInTheDocument();

    const startWatchingButton = await screen.findByTestId(
      "hero-start-watching-button",
    );

    await user.click(startWatchingButton);

    const dialog = await screen.findByTestId("hero-adblocker-alert");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("role", "dialog");
  });
});

describe("StreamingServices (Hero Search Input)", () => {
  let mockPush: ReturnType<typeof vi.fn>;
  let mockPrefetch: ReturnType<typeof vi.fn>;
  let mockRouter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush = vi.fn();
    mockPrefetch = vi.fn().mockResolvedValue(undefined);
    mockRouter = vi.fn(() => ({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: mockPrefetch,
    }));
    mockUseRouter.mockImplementation(mockRouter);
    mockUseDetectAdBlock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("navigates directly to search when adblock is detected", async () => {
    mockUseDetectAdBlock.mockReturnValue(true);

    const user = userEvent.setup();
    renderWithProviders(<StreamingServices />);

    const searchInput = await screen.findByTestId("hero-search-input");
    await user.type(searchInput, "test query");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/search?q=test%20query");
    });

    expect(mockPrefetch).toHaveBeenCalledWith("/search");
  });

  test("triggers alert when adblock is not detected", async () => {
    mockUseDetectAdBlock.mockReturnValue(false);

    const user = userEvent.setup();
    renderWithProviders(<StreamingServices />);

    const searchInput = await screen.findByTestId("hero-search-input");
    await user.type(searchInput, "test query");
    await user.keyboard("{Enter}");

    const dialog = await screen.findByTestId("hero-search-adblocker-alert");
    expect(dialog).toBeInTheDocument();

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPrefetch).toHaveBeenCalledWith("/search");
  });

  test("does not show alert initially", () => {
    mockUseDetectAdBlock.mockReturnValue(false);
    renderWithProviders(<StreamingServices />);

    expect(
      screen.queryByTestId("hero-search-adblocker-alert"),
    ).not.toBeInTheDocument();
  });

  test("shows alert only after searching without adblock", async () => {
    mockUseDetectAdBlock.mockReturnValue(false);

    const user = userEvent.setup();
    renderWithProviders(<StreamingServices />);

    expect(
      screen.queryByTestId("hero-search-adblocker-alert"),
    ).not.toBeInTheDocument();

    const searchInput = await screen.findByTestId("hero-search-input");
    await user.type(searchInput, "test query");
    await user.keyboard("{Enter}");

    const dialog = await screen.findByTestId("hero-search-adblocker-alert");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("role", "dialog");
  });

  test("navigates to search page when proceeding from alert", async () => {
    mockUseDetectAdBlock.mockReturnValue(false);

    const user = userEvent.setup();
    renderWithProviders(<StreamingServices />);

    const searchInput = await screen.findByTestId("hero-search-input");
    await user.type(searchInput, "test query");
    await user.keyboard("{Enter}");

    const dialog = await screen.findByTestId("hero-search-adblocker-alert");
    expect(dialog).toBeInTheDocument();

    const noThanksButton = await screen.findByRole("button", {
      name: /proceed without ad blocker/i,
    });
    await user.click(noThanksButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/search?q=test%20query");
    });
  });
});
