import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

// Mock Next.js navigation hooks for App Router
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

// Mock fetch globally if not already done
if (!global.fetch) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    }),
  );
}

// Mock intersection observer for prefetching tests
global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  thresholds: [0],
  root: null,
  rootMargin: "",
}));

// Mock window.matchMedia for responsive hooks
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Cleanup function for tests
afterEach(() => {
  vi.clearAllMocks();
});
