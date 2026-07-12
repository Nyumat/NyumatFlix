import { NavbarClient } from "@/components/layout/nav/navbar-client";
import {
  commitNavigationEntry,
  recordNavigationOrigin,
} from "@/lib/navigation/route-restoration";
import { useDetailRouteStore } from "@/lib/stores/detail-route-store";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname, useRouter } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/components/layout/site-nav-desktop", () => ({
  SiteNavDesktop: () => null,
}));

vi.mock("@/components/layout/site-nav", () => ({
  SiteNav: () => null,
}));

vi.mock("@/components/layout/anniversary-banner", () => ({
  AnniversaryBanner: () => null,
}));

vi.mock("@/components/search/search", () => ({
  NavbarSearchClient: () => null,
  SearchDialog: () => null,
}));

vi.mock("@/components/layout/nav/navbar-auth", () => ({
  NavbarAuth: () => null,
}));

vi.mock("@/components/layout/nav/navbar-mobile-navigation", () => ({
  NavbarMobileNavigation: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/layout/nav/user-avatar", () => ({
  UserAvatar: () => null,
}));

const mockUsePathname = vi.mocked(usePathname);
const mockUseRouter = vi.mocked(useRouter);

describe("NavbarClient detail back routing", () => {
  const push = vi.fn();
  const back = vi.fn();

  beforeEach(() => {
    useDetailRouteStore.getState().clearDetailRouteMetadata();
    window.history.replaceState({}, "", "/tvshows/123");
    window.sessionStorage.clear();
    mockUsePathname.mockReturnValue("/tvshows/123");
    mockUseRouter.mockReturnValue({
      push,
      back,
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    } as never);
  });

  test("routes TV detail pages to the TV parent by default", () => {
    render(<NavbarClient session={null} />);

    fireEvent.click(screen.getByLabelText("Go back"));

    expect(push).toHaveBeenCalledWith("/tvshows");
  });

  test("routes anime TV detail pages to the anime parent when overridden", () => {
    useDetailRouteStore.getState().setDetailRouteMetadata({
      pathname: "/tvshows/123",
      parentRoute: "/anime",
    });

    render(<NavbarClient session={null} />);

    fireEvent.click(screen.getByLabelText("Go back"));

    expect(push).toHaveBeenCalledWith("/anime");
  });

  test("ignores stale overrides from a different detail pathname", () => {
    useDetailRouteStore.getState().setDetailRouteMetadata({
      pathname: "/tvshows/456",
      parentRoute: "/anime",
    });

    render(<NavbarClient session={null} />);

    fireEvent.click(screen.getByLabelText("Go back"));

    expect(push).toHaveBeenCalledWith("/tvshows");
  });

  test("uses real history when the detail route was opened from a card", () => {
    window.history.replaceState({}, "", "/anime");
    const card = document.createElement("a");
    card.href = "/tvshows/123";
    document.body.append(card);
    recordNavigationOrigin(new URL(card.href), card);
    window.history.pushState({}, "", "/tvshows/123");
    commitNavigationEntry("/tvshows/123");

    render(<NavbarClient session={null} />);
    fireEvent.click(screen.getByLabelText("Go back"));

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  test("uses real history even if Next.js clears custom history state", () => {
    window.history.replaceState({}, "", "/anime");
    const card = document.createElement("a");
    card.href = "/tvshows/123";
    document.body.append(card);
    recordNavigationOrigin(new URL(card.href), card);
    window.history.pushState({}, "", "/tvshows/123");
    commitNavigationEntry("/tvshows/123");
    window.history.replaceState({ __NA: true }, "", "/tvshows/123");

    render(<NavbarClient session={null} />);
    fireEvent.click(screen.getByLabelText("Go back"));

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });
});
