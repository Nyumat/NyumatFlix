import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  CatalogCardStyleProvider,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import {
  CATALOG_CARD_STYLE_COOKIE,
  resolveCatalogCardStyleSnapshot,
} from "@/lib/user/catalog-card-style-store";

const Probe = () => {
  const style = useCatalogCardStyle();
  const [first] = useState(style);
  return (
    <span data-testid="style" data-first={first}>
      {style}
    </span>
  );
};

describe("catalog card style hydration", () => {
  beforeEach(() => {
    useAppSettingsStore.setState({ catalogCardStyle: "backdrop" });
    delete document.documentElement.dataset.catalogCardStyle;
    document.cookie = `${CATALOG_CARD_STYLE_COOKIE}=; path=/; max-age=0`;
    window.localStorage.clear();
  });

  it("resolves the request snapshot from the cookie", () => {
    expect(resolveCatalogCardStyleSnapshot("poster", "backdrop")).toBe(
      "poster",
    );
    expect(resolveCatalogCardStyleSnapshot("nope", "backdrop")).toBe(
      "backdrop",
    );
    expect(resolveCatalogCardStyleSnapshot(undefined, "poster")).toBe("poster");
    expect(resolveCatalogCardStyleSnapshot("poster", "backdrop", true)).toBe(
      "backdrop",
    );
  });

  it("hydrates the server snapshot when the store still has the default", () => {
    render(
      <CatalogCardStyleProvider initialStyle="poster">
        <Probe />
      </CatalogCardStyleProvider>,
    );

    expect(screen.getByTestId("style").dataset.first).toBe("poster");
    expect(screen.getByTestId("style").textContent).toBe("poster");
  });

  it("adopts a saved device choice only after the server snapshot", () => {
    document.cookie = `${CATALOG_CARD_STYLE_COOKIE}=poster; path=/`;

    render(
      <CatalogCardStyleProvider initialStyle="backdrop">
        <Probe />
      </CatalogCardStyleProvider>,
    );

    expect(screen.getByTestId("style").dataset.first).toBe("backdrop");
    expect(screen.getByTestId("style").textContent).toBe("poster");
    expect(useAppSettingsStore.getState().catalogCardStyle).toBe("poster");
  });

  it("keeps the server snapshot when only the paint dataset is set", () => {
    document.documentElement.dataset.catalogCardStyle = "poster";

    render(
      <CatalogCardStyleProvider initialStyle="backdrop">
        <Probe />
      </CatalogCardStyleProvider>,
    );

    expect(screen.getByTestId("style").dataset.first).toBe("backdrop");
    expect(screen.getByTestId("style").textContent).toBe("backdrop");
  });

  it("keeps the server snapshot when the style is locked", () => {
    document.cookie = `${CATALOG_CARD_STYLE_COOKIE}=poster; path=/`;

    render(
      <CatalogCardStyleProvider initialStyle="backdrop" locked>
        <Probe />
      </CatalogCardStyleProvider>,
    );

    expect(screen.getByTestId("style").textContent).toBe("backdrop");
    expect(useAppSettingsStore.getState().catalogCardStyle).toBe("backdrop");
  });

  it("follows store updates after the server snapshot", () => {
    useAppSettingsStore.setState({ catalogCardStyle: "poster" });

    render(
      <CatalogCardStyleProvider initialStyle="poster">
        <Probe />
      </CatalogCardStyleProvider>,
    );

    act(() => {
      useAppSettingsStore.setState({ catalogCardStyle: "backdrop" });
    });

    expect(screen.getByTestId("style").textContent).toBe("backdrop");
  });
});
