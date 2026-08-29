"use client";

export const warmCapWidgetAssets = async (): Promise<void> => {
  const response = await fetch("/api/cap/config", { cache: "no-store" });
  if (response.ok) {
    const data = (await response.json()) as { wasmUrl?: unknown };
    if (typeof data.wasmUrl === "string") {
      window.CAP_CUSTOM_WASM_URL = data.wasmUrl;
    }
  }
  await import("@cap.js/widget");
};
