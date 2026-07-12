import { AdblockerAlert } from "@/components/content/adblocker-alert";
import {
  AdblockGateProvider,
  useAdblockGateAction,
} from "@/components/providers/adblock-gate-provider";
import { GlobalDockProvider } from "@/components/layout/dock/global-dock";
import { TooltipProvider } from "@/components/ui/tooltip";
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

const GatedAction = ({ onRun }: { onRun: () => void }) => {
  const gateAction = useAdblockGateAction();

  return <button onClick={() => gateAction(onRun)}>Play</button>;
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
    expect(screen.getByText(/Scrape/i)).toBeInTheDocument();
    expect(screen.getByText(/server selector/i)).toBeInTheDocument();
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

  test("navigates to root when 'No thanks' is clicked from initial state", async () => {
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
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", {
          name: /adblock recommendation dialog/i,
        }),
      ).not.toBeInTheDocument();
    });
  });

  test("navigates to root when 'No thanks' is clicked from options view", async () => {
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
      expect(mockPush).toHaveBeenCalledWith("/");
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

  test("calls onProceed callback when provided instead of navigating to root", async () => {
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

describe("AdblockGateProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("remembers a no-thanks dismissal across provider mounts", async () => {
    const user = userEvent.setup();
    const firstAction = vi.fn();
    const firstRender = renderWithProviders(
      <AdblockGateProvider>
        <GatedAction onRun={firstAction} />
      </AdblockGateProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Play" }));
    await user.click(
      await screen.findByRole("button", {
        name: /proceed without ad blocker/i,
      }),
    );

    expect(firstAction).toHaveBeenCalledOnce();
    firstRender.unmount();

    const subsequentAction = vi.fn();
    renderWithProviders(
      <AdblockGateProvider>
        <GatedAction onRun={subsequentAction} />
      </AdblockGateProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Play" }));

    expect(subsequentAction).toHaveBeenCalledOnce();
    expect(
      screen.queryByTestId("adblocker-alert-dialog"),
    ).not.toBeInTheDocument();
  });
});
