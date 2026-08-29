import {
  CAP_WASM_CDN_VERSION,
  isCapDevBypassEnabled,
} from "@/lib/cap/constants";

const CAP_ENDPOINT_ENV = "CAP_API_ENDPOINT";

export const getCapApiEndpoint = (): string => {
  if (isCapDevBypassEnabled()) {
    return "http://localhost:3030/dev-bypass/";
  }

  const rawEndpoint = process.env[CAP_ENDPOINT_ENV]?.trim();
  if (!rawEndpoint) {
    throw new Error(`${CAP_ENDPOINT_ENV} is not configured`);
  }

  const endpoint = new URL(rawEndpoint);
  if (
    endpoint.protocol !== "https:" &&
    !(
      process.env.NODE_ENV !== "production" &&
      endpoint.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(endpoint.hostname)
    )
  ) {
    throw new Error(
      `${CAP_ENDPOINT_ENV} must use HTTPS outside local development`,
    );
  }

  endpoint.hash = "";
  endpoint.search = "";
  if (!endpoint.pathname.endsWith("/")) endpoint.pathname += "/";
  return endpoint.toString();
};

export const getCapWasmUrl = (): string =>
  `https://cdn.jsdelivr.net/npm/@cap.js/wasm@${CAP_WASM_CDN_VERSION}/browser/cap_wasm_bg.wasm`;
