import { NavbarClient } from "@/components/layout/nav/navbar-client";
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

  beforeEach(() => {
    useDetailRouteStore.getState().clearDetailRouteMetadata();
    mockUsePathname.mockReturnValue("/tvshows/123");
    mockUseRouter.mockReturnValue({
      push,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    } as never);
  });

  test("routes TV detail pages to the TV parent by default", () => {
    render(<NavbarClient session={null} />);

    fireEvent.click(screen.getByLabelText("Back to parent page"));

    expect(push).toHaveBeenCalledWith("/tvshows");
  });

  test("routes anime TV detail pages to the anime parent when overridden", () => {
    useDetailRouteStore.getState().setDetailRouteMetadata({
      pathname: "/tvshows/123",
      parentRoute: "/anime",
    });

    render(<NavbarClient session={null} />);

    fireEvent.click(screen.getByLabelText("Back to parent page"));

    expect(push).toHaveBeenCalledWith("/anime");
  });

  test("ignores stale overrides from a different detail pathname", () => {
    useDetailRouteStore.getState().setDetailRouteMetadata({
      pathname: "/tvshows/456",
      parentRoute: "/anime",
    });

    render(<NavbarClient session={null} />);

    fireEvent.click(screen.getByLabelText("Back to parent page"));

    expect(push).toHaveBeenCalledWith("/tvshows");
  });
});
