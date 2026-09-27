import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  CatalogCardStyleProvider,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { resolveCatalogCardStyleSnapshot } from "@/lib/user/catalog-card-style-store";

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
  });

  it("resolves the request snapshot from the cookie", () => {
    expect(resolveCatalogCardStyleSnapshot("poster", "backdrop")).toBe(
      "poster",
    );
    expect(resolveCatalogCardStyleSnapshot("nope", "backdrop")).toBe(
      "backdrop",
    );
    expect(resolveCatalogCardStyleSnapshot(undefined, "poster")).toBe("poster");
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

  it("adopts a saved preference only after the server snapshot", () => {
    document.documentElement.dataset.catalogCardStyle = "poster";

    render(
      <CatalogCardStyleProvider initialStyle="backdrop">
        <Probe />
      </CatalogCardStyleProvider>,
    );

    expect(screen.getByTestId("style").dataset.first).toBe("backdrop");
    expect(screen.getByTestId("style").textContent).toBe("poster");
    expect(useAppSettingsStore.getState().catalogCardStyle).toBe("poster");
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
