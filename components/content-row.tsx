"use client";

// Re-export the core ContentRow and its types from the content sub-directory
export {
  ContentRow,
  type ContentRowProps,
  type ContentRowVariant,
} from "./content/content-row";

// Re-export the ServerContentRow for SSR usage
export { ServerContentRow } from "./content/server-content-row";

// ContentRowActual has been removed as it was unused and duplicated pagination logic.
// If API-backed infinite scrolling is needed, the component using ContentRow
// should provide the appropriate `onLoadMore` function.
