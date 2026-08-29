const CAP_ENDPOINT_ENV = "CAP_API_ENDPOINT";

export const getCapApiEndpoint = (): string => {
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

export const getCapWasmUrl = (): string => {
  const endpoint = new URL(getCapApiEndpoint());
  return new URL("assets/cap_wasm_bg.wasm", endpoint).toString();
};
