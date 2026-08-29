import { useDetailRouteStore } from "@/lib/stores/detail-route-store";
import { beforeEach, describe, expect, test } from "vitest";

describe("detail-route-store", () => {
  beforeEach(() => {
    useDetailRouteStore.getState().clearDetailRouteMetadata();
  });

  test("returns a parent route override for the matching pathname", () => {
    useDetailRouteStore.getState().setDetailRouteMetadata({
      pathname: "/tvshows/123",
      parentRoute: "/anime",
    });

    expect(
      useDetailRouteStore.getState().getParentRouteOverride("/tvshows/123"),
    ).toBe("/anime");
  });

  test("does not return stale metadata for a different pathname", () => {
    useDetailRouteStore.getState().setDetailRouteMetadata({
      pathname: "/tvshows/123",
      parentRoute: "/anime",
    });

    expect(
      useDetailRouteStore.getState().getParentRouteOverride("/tvshows/456"),
    ).toBeUndefined();
  });

  test("only clears pathname-scoped metadata when the pathname matches", () => {
    useDetailRouteStore.getState().setDetailRouteMetadata({
      pathname: "/tvshows/123",
      parentRoute: "/anime",
    });

    useDetailRouteStore.getState().clearDetailRouteMetadata("/tvshows/456");
    expect(
      useDetailRouteStore.getState().getParentRouteOverride("/tvshows/123"),
    ).toBe("/anime");

    useDetailRouteStore.getState().clearDetailRouteMetadata("/tvshows/123");
    expect(
      useDetailRouteStore.getState().getParentRouteOverride("/tvshows/123"),
    ).toBeUndefined();
  });
});
