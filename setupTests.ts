import "@testing-library/jest-dom/vitest";
import { URLSearchParams } from "node:url";
import ResizeObserver from "resize-observer-polyfill";
import { afterEach, Mock, vi } from "vitest";

type GlobalType = typeof globalThis & {
  fetch: typeof fetch;
  IntersectionObserver: typeof IntersectionObserver;
  ResizeObserver: typeof ResizeObserver;
  matchMedia: typeof matchMedia;
};

declare global {
  let fn: GlobalType;
}

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

vi.mock("adblock-detect-react", () => ({
  useDetectAdBlock: vi.fn(() => false),
}));

if (!global.fetch) {
  global.fetch = vi.fn() as Mock<() => Promise<Response>>;
}

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  thresholds: [0],
  root: null,
  rootMargin: "",
}));

global.ResizeObserver = ResizeObserver;

Object.defineProperty(global, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(global, "scrollTo", {
  writable: true,
  value: vi.fn(),
});

if (typeof window !== "undefined") {
  window.scrollTo = vi.fn();
}

afterEach(() => {
  vi.clearAllMocks();
});
